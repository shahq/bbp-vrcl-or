import React from 'react';
import type { UserPresence } from '../../party/index';

interface ActiveUsersProps {
  users: UserPresence[];
  currentUserId: string;
}

export function ActiveUsers({ users, currentUserId }: ActiveUsersProps) {
  const uniqueUsers = Array.from(new Map(users.map(user => [user.id, user])).values());
  const otherUsers = uniqueUsers.filter(user => user.id !== currentUserId);
  const totalActive = Math.max(uniqueUsers.length, currentUserId ? 1 : 0);

  if (otherUsers.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-2 h-2 rounded-full bg-gray-300" />
        <span>Only you</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span>{totalActive} active</span>
      </div>
      
      <div className="flex -space-x-2">
        {otherUsers.slice(0, 4).map((user) => (
          <div key={user.id} className="group relative">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm"
              style={{ backgroundColor: user.color }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
              <div className="whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg">
                {user.name}
              </div>
            </div>
          </div>
        ))}
        {otherUsers.length > 4 && (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold border-2 border-white">
            +{otherUsers.length - 4}
          </div>
        )}
      </div>
    </div>
  );
}

interface UserCursorsProps {
  users: UserPresence[];
  currentUserId: string;
}

export function UserCursors({ users, currentUserId }: UserCursorsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[100]">
      {users
        .filter(user => user.id !== currentUserId && user.cursor)
        .map(user => (
          <UserCursor key={user.id} user={user} />
        ))}
    </div>
  );
}

function UserCursor({ user }: { user: UserPresence }) {
  if (!user.cursor) return null;

  return (
    <div
      className="absolute"
      style={{
        left: user.cursor.x,
        top: user.cursor.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Cursor SVG */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
        }}
      >
        <path
          d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
          fill={user.color}
          stroke="white"
          strokeWidth="1"
        />
      </svg>
      
      {/* Name label */}
      <div
        className="absolute left-4 top-4 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap"
        style={{ backgroundColor: user.color }}
      >
        {user.name}
      </div>
    </div>
  );
}

interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  message?: string;
}

export function ConnectionStatus({ isConnected, isConnecting, message }: ConnectionStatusProps) {
  if (isConnecting) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-sm">
        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        <span>Connecting...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-sm">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span>{message || 'Disconnected'}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm">
      <div className="w-2 h-2 rounded-full bg-green-500" />
      <span>Connected</span>
    </div>
  );
}
