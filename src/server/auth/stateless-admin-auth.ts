import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import type { AdminAuthProvider, AdminSession } from "../backend/types";
import type { TimerControlMode } from "../../config/timer";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "shazam!";
const SESSION_DURATION_HOURS = 8;
const PARTYKIT_ADMIN_SECRET = process.env.PARTYKIT_ADMIN_SECRET || ADMIN_PASSWORD;
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || PARTYKIT_ADMIN_SECRET;
const PARTYKIT_TOKEN_DURATION_MS = 15 * 60 * 1000;

interface StatelessAdminPayload {
  id: string;
  created_at: string;
  expires_at: string;
}

function sign(value: string) {
  return crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(value).digest("base64url");
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function encodeSession(payload: StatelessAdminPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function decodeSession(sessionId: string | undefined): AdminSession | null {
  if (!sessionId) return null;

  const [encodedPayload, signature] = sessionId.split(".");
  if (!encodedPayload || !signature || !timingSafeEqual(signature, sign(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as StatelessAdminPayload;
    const expiresAt = Date.parse(payload.expires_at);
    if (!payload.id || !payload.created_at || Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function getSessionFromRequest(req: Request) {
  const headerSessionId = Array.isArray(req.headers["x-admin-session"])
    ? req.headers["x-admin-session"][0]
    : req.headers["x-admin-session"];
  const sessionId = typeof headerSessionId === "string" ? headerSessionId : req.cookies?.adminSession;
  return decodeSession(sessionId);
}

function createPartyKitToken(payload: Record<string, unknown>) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", PARTYKIT_ADMIN_SECRET)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export const statelessAdminAuthProvider: AdminAuthProvider = {
  cleanupExpiredSessions() {},

  verifyAdminPassword(password: string) {
    return password === ADMIN_PASSWORD;
  },

  createAdminSession() {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
    const id = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const session = {
      id,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    return {
      ...session,
      id: encodeSession(session),
    };
  },

  deleteAdminSession() {
    return true;
  },

  isAdminAuthenticated(req: Request) {
    return getSessionFromRequest(req) !== null;
  },

  requireAdminAuth(req: Request, res: Response, next: NextFunction) {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    (req as any).adminSession = session;
    next();
  },

  createPartyKitAdminToken(sessionId: string) {
    return createPartyKitToken({
      role: "admin",
      sessionId,
      exp: Date.now() + PARTYKIT_TOKEN_DURATION_MS,
    });
  },

  createPartyKitSessionSettingsToken(settings: {
    sessionId: string;
    timerControlMode: TimerControlMode;
    sessionUpdatedAt: string;
  }) {
    return createPartyKitToken({
      type: "session-settings",
      sessionId: settings.sessionId,
      timerControlMode: settings.timerControlMode,
      sessionUpdatedAt: settings.sessionUpdatedAt,
      exp: Date.now() + PARTYKIT_TOKEN_DURATION_MS,
    });
  },
};
