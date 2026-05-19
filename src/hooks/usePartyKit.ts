import { useEffect, useRef, useState, useCallback } from 'react';
import PartySocket from 'partysocket';
import type { Message, UserPresence, LiveConnection } from '../../party/index';
import type { CardData, ConnectionData } from '../types';
import {
  PARTYKIT_HOST,
  PARTYKIT_HTTP_PROTOCOL,
  PARTYKIT_PARTY,
  PARTYKIT_WS_PROTOCOL,
} from '../config/partykit';

interface UsePartyKitOptions {
  sessionId: string | null;
  userId: string;
  userName: string;
  userColor: string;
  adminToken?: string | null;
  onCardCreate?: (card: CardData) => void;
  onCardUpdate?: (cardId: string, updates: Partial<CardData>) => void;
  onCardDelete?: (cardId: string) => void;
  onCardReorder?: (section: string, cardIds: string[]) => void;
  onConnectionCreate?: (connection: ConnectionData) => void;
  onConnectionDelete?: (connectionId: string) => void;
  onCursorMove?: (userId: string, x: number, y: number) => void;
  onUserLeave?: (userId: string) => void;
  onKicked?: (message: string) => void;
  onProjectUpdate?: (updates: { project_client?: string; project_background?: string; project_notes?: string }) => void;
}

interface UsePartyKitReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  users: UserPresence[];
  liveConnections: LiveConnection[];
  currentConnectionId: string | null;
  connectionRole: 'admin' | 'participant' | null;
  sendCardCreate: (card: CardData) => void;
  sendCardUpdate: (cardId: string, updates: Partial<CardData>) => void;
  sendCardDelete: (cardId: string) => void;
  sendCardReorder: (section: string, cardIds: string[]) => void;
  sendConnectionCreate: (connection: ConnectionData) => void;
  sendConnectionDelete: (connectionId: string) => void;
  sendPresenceUpdate: (updates: Partial<UserPresence>) => void;
  sendCursorMove: (x: number, y: number) => void;
  sendAdminKick: (connectionId: string, userId?: string | null) => void;
  sendProjectUpdate: (updates: { project_client?: string; project_background?: string; project_notes?: string }) => void;
  reconnect: () => void;
}

export function usePartyKit({
  sessionId,
  userId,
  userName,
  userColor,
  adminToken,
  onCardCreate,
  onCardUpdate,
  onCardDelete,
  onCardReorder,
  onConnectionCreate,
  onConnectionDelete,
  onCursorMove,
  onUserLeave,
  onKicked,
  onProjectUpdate,
}: UsePartyKitOptions): UsePartyKitReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [liveConnections, setLiveConnections] = useState<LiveConnection[]>([]);
  const [currentConnectionId, setCurrentConnectionId] = useState<string | null>(null);
  const [connectionRole, setConnectionRole] = useState<'admin' | 'participant' | null>(null);

  const socketRef = useRef<PartySocket | null>(null);
  const kickedMessageRef = useRef<string | null>(null);
  const adminTokenRef = useRef(adminToken);
  const lastCursorSentAtRef = useRef(0);
  const callbacksRef = useRef({
    onCardCreate,
    onCardUpdate,
    onCardDelete,
    onCardReorder,
    onConnectionCreate,
    onConnectionDelete,
    onCursorMove,
    onUserLeave,
    onKicked,
    onProjectUpdate,
  });
  const userPresenceRef = useRef<UserPresence>({
    id: userId,
    name: userName,
    color: userColor,
    lastActive: Date.now(),
  });

  useEffect(() => {
    adminTokenRef.current = adminToken;
  }, [adminToken]);

  useEffect(() => {
    userPresenceRef.current = {
      ...userPresenceRef.current,
      id: userId,
      name: userName,
      color: userColor,
    };
  }, [userId, userName, userColor]);

  useEffect(() => {
    callbacksRef.current = {
      onCardCreate,
      onCardUpdate,
      onCardDelete,
      onCardReorder,
      onConnectionCreate,
      onConnectionDelete,
      onCursorMove,
      onUserLeave,
      onKicked,
      onProjectUpdate,
    };
  }, [
    onCardCreate,
    onCardDelete,
    onCardReorder,
    onCardUpdate,
    onConnectionCreate,
    onConnectionDelete,
    onCursorMove,
    onKicked,
    onProjectUpdate,
    onUserLeave,
  ]);

  useEffect(() => {
    if (!sessionId) {
      setIsConnected(false);
      setUsers([]);
      setLiveConnections([]);
      setCurrentConnectionId(null);
      setConnectionRole(null);
      return;
    }

    setIsConnecting(true);
    setError(null);
    kickedMessageRef.current = null;

    const room = `session-${sessionId}`;
    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room,
      party: PARTYKIT_PARTY,
      protocol: PARTYKIT_WS_PROTOCOL,
      query: () => (adminTokenRef.current ? { adminToken: adminTokenRef.current } : {}),
    });

    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      setCurrentConnectionId(socket.id);

      const joinMessage: Message = {
        type: 'presence:update',
        user: {
          ...userPresenceRef.current,
          lastActive: Date.now(),
        },
        timestamp: Date.now(),
      };
      socket.send(JSON.stringify(joinMessage));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Message;

        switch (data.type) {
          case 'project:update':
            if (data.userId !== userId && callbacksRef.current.onProjectUpdate) {
              callbacksRef.current.onProjectUpdate(data.updates);
            }
            break;

          case 'card:create':
            if (data.userId !== userId && callbacksRef.current.onCardCreate) {
              callbacksRef.current.onCardCreate(data.card);
            }
            break;

          case 'card:update':
            if (data.userId !== userId && callbacksRef.current.onCardUpdate) {
              callbacksRef.current.onCardUpdate(data.cardId, data.updates);
            }
            break;

          case 'card:delete':
            if (data.userId !== userId && callbacksRef.current.onCardDelete) {
              callbacksRef.current.onCardDelete(data.cardId);
            }
            break;

          case 'card:reorder':
            if (data.userId !== userId && callbacksRef.current.onCardReorder) {
              callbacksRef.current.onCardReorder(data.section, data.cardIds);
            }
            break;

          case 'connection:create':
            if (data.userId !== userId && callbacksRef.current.onConnectionCreate) {
              callbacksRef.current.onConnectionCreate(data.connection);
            }
            break;

          case 'connection:delete':
            if (data.userId !== userId && callbacksRef.current.onConnectionDelete) {
              callbacksRef.current.onConnectionDelete(data.connectionId);
            }
            break;

          case 'room:snapshot': {
            setUsers(Array.isArray(data.users) ? data.users : []);
            setLiveConnections(Array.isArray(data.connections) ? data.connections : []);
            const selfConnection = Array.isArray(data.connections)
              ? data.connections.find((entry) => entry.connectionId === socket.id)
              : undefined;
            setConnectionRole(selfConnection?.role ?? 'participant');
            break;
          }

          case 'cursor:move':
            if (data.userId !== userId && callbacksRef.current.onCursorMove) {
              callbacksRef.current.onCursorMove(data.userId, data.x, data.y);
            }
            setUsers((prev) =>
              prev.map((user) =>
                user.id === data.userId ? { ...user, cursor: { x: data.x, y: data.y } } : user
              )
            );
            break;

          case 'user:kick':
            if (data.userId === userId) {
              kickedMessageRef.current = data.message;
              setError(new Error(data.message));
              callbacksRef.current.onKicked?.(data.message);
              socketRef.current?.close();
            } else if (callbacksRef.current.onUserLeave) {
              callbacksRef.current.onUserLeave(data.userId);
            }
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('[PartyKit] Error parsing message:', err);
      }
    };

    socket.onerror = () => {
      setError((prev) => prev ?? new Error('WebSocket connection error'));
      setIsConnected(false);
      setIsConnecting(false);
    };

    socket.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
      setCurrentConnectionId(null);
      if (!kickedMessageRef.current) {
        setConnectionRole(null);
      }
    };

    const heartbeatInterval = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        const heartbeat: Message = {
          type: 'presence:update',
          user: {
            ...userPresenceRef.current,
            lastActive: Date.now(),
          },
          timestamp: Date.now(),
        };
        socket.send(JSON.stringify(heartbeat));
      }
    }, 20000);

    const handleBeforeUnload = () => {
      if (socket.readyState === WebSocket.OPEN) {
        const leaveMessage: Message = {
          type: 'user:leave',
          userId,
          timestamp: Date.now(),
        };
        const blob = new Blob([JSON.stringify(leaveMessage)], { type: 'application/json' });
        const roomUrl = `${PARTYKIT_HTTP_PROTOCOL}://${PARTYKIT_HOST}${socket.roomUrl.replace(/^wss?:\/\/[^/]+/, '')}`;
        navigator.sendBeacon(roomUrl, blob);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      socket.close();
      socketRef.current = null;
    };
  }, [
    sessionId,
    userId,
  ]);

  const sendCardCreate = useCallback((card: CardData) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const message: Message = {
        type: 'card:create',
        card,
        timestamp: Date.now(),
        userId,
      };
      socketRef.current.send(JSON.stringify(message));
    }
  }, [userId]);

  const sendCardUpdate = useCallback((cardId: string, updates: Partial<CardData>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const message: Message = {
        type: 'card:update',
        cardId,
        updates,
        timestamp: Date.now(),
        userId,
      };
      socketRef.current.send(JSON.stringify(message));
    }
  }, [userId]);

  const sendCardDelete = useCallback((cardId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const message: Message = {
        type: 'card:delete',
        cardId,
        timestamp: Date.now(),
        userId,
      };
      socketRef.current.send(JSON.stringify(message));
    }
  }, [userId]);

  const sendCardReorder = useCallback((section: string, cardIds: string[]) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const message: Message = {
        type: 'card:reorder',
        section,
        cardIds,
        timestamp: Date.now(),
        userId,
      };
      socketRef.current.send(JSON.stringify(message));
    }
  }, [userId]);

  const sendConnectionCreate = useCallback((connection: ConnectionData) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const message: Message = {
        type: 'connection:create',
        connection,
        timestamp: Date.now(),
        userId,
      };
      socketRef.current.send(JSON.stringify(message));
    }
  }, [userId]);

  const sendConnectionDelete = useCallback((connectionId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const message: Message = {
        type: 'connection:delete',
        connectionId,
        timestamp: Date.now(),
        userId,
      };
      socketRef.current.send(JSON.stringify(message));
    }
  }, [userId]);

  const sendPresenceUpdate = useCallback((updates: Partial<UserPresence>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      userPresenceRef.current = { ...userPresenceRef.current, ...updates };
      const message: Message = {
        type: 'presence:update',
        user: {
          ...userPresenceRef.current,
          lastActive: Date.now(),
        },
        timestamp: Date.now(),
      };
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendCursorMove = useCallback((x: number, y: number) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const now = Date.now();
      if (now - lastCursorSentAtRef.current < 33) {
        return;
      }
      lastCursorSentAtRef.current = now;

      const message: Message = {
        type: 'cursor:move',
        userId,
        x,
        y,
        timestamp: now,
      };
      socketRef.current.send(JSON.stringify(message));
    }
  }, [userId]);

  const sendAdminKick = useCallback((connectionId: string, kickedUserId?: string | null) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const message: Message = {
        type: 'admin:kick',
        connectionId,
        userId: kickedUserId ?? undefined,
        timestamp: Date.now(),
      };
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendProjectUpdate = useCallback((updates: { project_client?: string; project_background?: string; project_notes?: string }) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const message: Message = {
        type: 'project:update',
        updates,
        timestamp: Date.now(),
        userId,
      };
      socketRef.current.send(JSON.stringify(message));
    }
  }, [userId]);

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      kickedMessageRef.current = null;
      socketRef.current.reconnect();
    }
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    users,
    liveConnections,
    currentConnectionId,
    connectionRole,
    sendCardCreate,
    sendCardUpdate,
    sendCardDelete,
    sendCardReorder,
    sendConnectionCreate,
    sendConnectionDelete,
    sendPresenceUpdate,
    sendCursorMove,
    sendAdminKick,
    sendProjectUpdate,
    reconnect,
  };
}
