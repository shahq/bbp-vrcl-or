import type * as Party from "partykit/server";
import type { CardData, ConnectionData } from "../src/types";

type ConnectionRole = "admin" | "participant";

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  lastActive: number;
  isEditing?: string;
}

export interface LiveConnection {
  connectionId: string;
  userId: string | null;
  name: string;
  color: string;
  lastActive: number;
  isEditing?: string;
  isActive: boolean;
  role: ConnectionRole;
}

export type Message =
  | { type: "project:update"; updates: { project_client?: string; project_background?: string; project_notes?: string }; timestamp: number; userId: string }
  | { type: "card:create"; card: CardData; timestamp: number; userId: string }
  | { type: "card:update"; cardId: string; updates: Partial<CardData>; timestamp: number; userId: string }
  | { type: "card:delete"; cardId: string; timestamp: number; userId: string }
  | { type: "card:reorder"; section: string; cardIds: string[]; timestamp: number; userId: string }
  | { type: "connection:create"; connection: ConnectionData; timestamp: number; userId: string }
  | { type: "connection:delete"; connectionId: string; timestamp: number; userId: string }
  | { type: "presence:update"; user: UserPresence; timestamp: number }
  | { type: "cursor:move"; userId: string; x: number; y: number; timestamp: number }
  | { type: "user:join"; user: UserPresence; timestamp: number }
  | { type: "user:leave"; userId: string; timestamp: number }
  | { type: "admin:kick"; connectionId?: string; userId?: string; timestamp: number }
  | { type: "user:kick"; userId: string; message: string; timestamp: number }
  | { type: "room:snapshot"; users: UserPresence[]; connections: LiveConnection[]; timestamp: number };

interface RoomState {
  lastActivity: number;
}

interface ConnectionState {
  role: ConnectionRole;
  userId?: string;
  name?: string;
  color?: string;
  cursor?: { x: number; y: number };
  lastActive?: number;
  isEditing?: string;
}

interface AdminTokenPayload {
  role: "admin";
  sessionId: string;
  exp: number;
}

const ACTIVE_THRESHOLD = 30000;
const SNAPSHOT_INTERVAL = 30000;

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }

  return diff === 0;
}

function decodeBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function decodeBase64UrlText(input: string): string {
  return new TextDecoder().decode(decodeBase64Url(input));
}

async function verifyAdminToken(token: string, secret: string): Promise<boolean> {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  let payload: AdminTokenPayload;
  try {
    payload = JSON.parse(decodeBase64UrlText(encodedPayload)) as AdminTokenPayload;
  } catch {
    return false;
  }

  if (payload.role !== "admin" || typeof payload.exp !== "number" || payload.exp <= Date.now()) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedSignature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));

  return timingSafeEqual(new Uint8Array(expectedSignature), decodeBase64Url(signature));
}

export default class SessionServer implements Party.Server {
  options: Party.ServerOptions = {
    hibernate: false,
  };

  private state: RoomState;

  constructor(readonly room: Party.Room) {
    this.state = {
      lastActivity: Date.now(),
    };
    this.scheduleSnapshot();
  }

  private scheduleSnapshot(): void {
    this.room.storage.setAlarm(Date.now() + SNAPSHOT_INTERVAL);
  }

  private getConnectionState(connection: Party.Connection): ConnectionState {
    const state = (connection.state ?? {}) as Partial<ConnectionState>;
    return {
      role: state.role === "admin" ? "admin" : "participant",
      userId: state.userId,
      name: state.name,
      color: state.color,
      cursor: state.cursor,
      lastActive: state.lastActive,
      isEditing: state.isEditing,
    };
  }

  private updateConnectionState(connection: Party.Connection, patch: Partial<ConnectionState>): ConnectionState {
    const nextState = {
      ...this.getConnectionState(connection),
      ...patch,
    };
    connection.setState(nextState);
    return nextState;
  }

  private getLiveConnections(now = Date.now()): LiveConnection[] {
    return Array.from(this.room.getConnections())
      .map((connection) => {
        const state = this.getConnectionState(connection);
        const lastActive = state.lastActive ?? now;

        return {
          connectionId: connection.id,
          userId: state.userId ?? null,
          name: state.name ?? (state.role === "admin" ? "Admin" : "Unknown"),
          color: state.color ?? (state.role === "admin" ? "#EF4444" : "#9CA3AF"),
          lastActive,
          isEditing: state.isEditing,
          isActive: now - lastActive < ACTIVE_THRESHOLD,
          role: state.role,
        };
      })
      .filter((entry) => entry.userId !== null);
  }

  private getActiveUsers(connections: LiveConnection[]): UserPresence[] {
    const deduped = new Map<string, UserPresence>();

    for (const connection of connections) {
      if (!connection.userId || !connection.isActive) continue;

      const existing = deduped.get(connection.userId);
      if (!existing || connection.lastActive >= existing.lastActive) {
        deduped.set(connection.userId, {
          id: connection.userId,
          name: connection.name,
          color: connection.color,
          lastActive: connection.lastActive,
          isEditing: connection.isEditing,
        });
      }
    }

    for (const connection of this.room.getConnections()) {
      const state = this.getConnectionState(connection);
      if (!state.userId || !state.cursor) continue;

      const existing = deduped.get(state.userId);
      if (existing) {
        existing.cursor = state.cursor;
      }
    }

    return Array.from(deduped.values());
  }

  private getSnapshotMessage(): Extract<Message, { type: "room:snapshot" }> {
    const connections = this.getLiveConnections();
    return {
      type: "room:snapshot",
      users: this.getActiveUsers(connections),
      connections,
      timestamp: Date.now(),
    };
  }

  private broadcastSnapshot(target?: Party.Connection): void {
    const snapshot = JSON.stringify(this.getSnapshotMessage());
    if (target) {
      target.send(snapshot);
      return;
    }

    this.room.broadcast(snapshot);
  }

  private async resolveRole(ctx: Party.ConnectionContext): Promise<ConnectionRole> {
    const secret = String(this.room.env.PARTYKIT_ADMIN_SECRET || this.room.env.ADMIN_PASSWORD || "shazam!");
    const url = new URL(ctx.request.url);
    const adminToken = url.searchParams.get("adminToken");

    if (!adminToken) {
      return "participant";
    }

    const verified = await verifyAdminToken(adminToken, secret);
    return verified ? "admin" : "participant";
  }

  private disconnectConnection(connectionId?: string, userId?: string): boolean {
    let disconnected = false;

    for (const connection of this.room.getConnections()) {
      const state = this.getConnectionState(connection);
      const matchesConnectionId = !!connectionId && connection.id === connectionId;
      const matchesUserId = !!userId && state.userId === userId;

      if (!matchesConnectionId && !matchesUserId) continue;

      connection.send(JSON.stringify({
        type: "user:kick",
        userId: state.userId ?? userId ?? "unknown",
        message: "You were disconnected by an admin.",
        timestamp: Date.now(),
      } satisfies Message));
      connection.close();
      disconnected = true;
    }

    if (disconnected) {
      this.broadcastSnapshot();
    }

    return disconnected;
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext): Promise<void> {
    const role = await this.resolveRole(ctx);
    this.updateConnectionState(conn, {
      role,
      lastActive: Date.now(),
    });
    this.state.lastActivity = Date.now();
    this.scheduleSnapshot();
    this.broadcastSnapshot(conn);
  }

  onMessage(message: string, sender: Party.Connection): void {
    try {
      const data = JSON.parse(message) as Message;
      this.state.lastActivity = Date.now();

      switch (data.type) {
        case "project:update":
        case "card:create":
        case "card:update":
        case "card:delete":
        case "card:reorder":
        case "connection:create":
        case "connection:delete":
          this.room.broadcast(message, [sender.id]);
          break;

        case "presence:update":
        case "user:join":
          this.updateConnectionState(sender, {
            userId: data.user.id,
            name: data.user.name,
            color: data.user.color,
            cursor: data.user.cursor,
            isEditing: data.user.isEditing,
            lastActive: Date.now(),
          });
          this.scheduleSnapshot();
          this.broadcastSnapshot();
          break;

        case "cursor:move":
          this.updateConnectionState(sender, {
            userId: data.userId,
            cursor: { x: data.x, y: data.y },
            lastActive: Date.now(),
          });
          this.room.broadcast(message, [sender.id]);
          break;

        case "user:leave":
          // Connection close is the primary source of truth for membership.
          break;

        case "admin:kick": {
          const senderState = this.getConnectionState(sender);
          if (senderState.role !== "admin") {
            console.warn("[PartyKit] Ignoring admin:kick from non-admin connection", sender.id);
            break;
          }

          this.disconnectConnection(data.connectionId, data.userId);
          break;
        }

        default:
          console.log(`[PartyKit] Unknown message type: ${(data as { type?: string }).type}`);
      }
    } catch (error) {
      console.error("[PartyKit] Error handling message:", error);
    }
  }

  onClose(): void {
    this.state.lastActivity = Date.now();
    this.scheduleSnapshot();
    this.broadcastSnapshot();
  }

  async onRequest(req: Party.Request): Promise<Response> {
    const url = new URL(req.url);
    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
    const isRoomRoot = normalizedPath === "/" || normalizedPath.endsWith(`/${this.room.id}`);

    if (req.method === "GET" && (isRoomRoot || normalizedPath.endsWith("/health"))) {
      return new Response(JSON.stringify({
        status: "ok",
        room: this.room.id,
        ...this.getSnapshotMessage(),
        lastActivity: this.state.lastActivity,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  }

  onAlarm(): void {
    this.scheduleSnapshot();
    this.broadcastSnapshot();
  }
}
