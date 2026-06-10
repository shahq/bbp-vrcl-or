/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, Cpu, Plus, Trash2, Lock, Unlock, Download, LogOut, Shield, PanelLeftClose, PanelLeft } from 'lucide-react';
import { ModelType } from '../services/ai';
import type { LiveConnection } from '../../party/index';
import type { TimerControlMode } from '../config/timer';

interface Session {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  project_client?: string;
  project_background?: string;
  project_notes?: string;
  onboarding_completed?: boolean;
  has_password?: boolean;
  timer_control_mode?: TimerControlMode;
}

interface SidebarProps {
  onViewChange: (view: 'new' | 'canvas') => void;
  currentView: 'new' | 'canvas';
  selectedModel: ModelType;
  onModelChange: (model: ModelType) => void;
  sessions?: Session[];
  currentSession?: Session | null;
  isEditMode?: boolean;
  isAdmin?: boolean;
  onCreateSession?: (name: string, requirePassword: boolean) => Promise<void>;
  onDeleteSession?: (sessionId: string) => Promise<void>;
  onLoadSession?: (sessionId: string) => void;
  onExportSession?: (format: 'zip' | 'markdown' | 'json') => void;
  onLogout?: () => void;
  onEditRequest?: () => void;
  activeConnections?: LiveConnection[];
  currentConnectionId?: string;
  onKickUser?: (connectionId: string, userId?: string | null) => Promise<void>;
  presenceDebug?: string;
}

export default function Sidebar({ 
  onViewChange, 
  currentView, 
  selectedModel, 
  onModelChange,
  sessions = [],
  currentSession,
  isEditMode,
  isAdmin,
  onCreateSession,
  onDeleteSession,
  onLoadSession,
  onExportSession,
  onLogout,
  onEditRequest,
  activeConnections = [],
  currentConnectionId = '',
  onKickUser,
  presenceDebug
}: SidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [requirePassword, setRequirePassword] = useState(false);
  const [isCompact, setIsCompact] = useState(() => {
    const stored = localStorage.getItem('bbp_sidebar_compact');
    return stored ? stored === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('bbp_sidebar_compact', String(isCompact));
  }, [isCompact]);

  // Non-admin: render nothing so layout does not reserve sidebar space
  if (!isAdmin) {
    return null;
  }

  const handleCreateSession = async () => {
    if (!newSessionName.trim() || !onCreateSession) return;
    
    setIsCreating(true);
    try {
      await onCreateSession(newSessionName, requirePassword);
      setNewSessionName('');
      setRequirePassword(false);
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (onDeleteSession) {
      await onDeleteSession(sessionId);
    }
  };

  const handleSessionClick = (sessionId: string) => {
    if (onLoadSession) {
      onLoadSession(sessionId);
    }
  };

  const visibleConnections = Array.from(
    new Map(
      activeConnections
        .filter(entry => entry.connectionId !== currentConnectionId && entry.role !== 'admin')
        .map(entry => [entry.connectionId, entry])
    ).values()
  );

  if (isCompact) {
    return (
      <div className="w-16 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <button
            onClick={() => setIsCompact(false)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title="Expand sidebar"
          >
            <PanelLeft size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col items-center py-4 gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
            SQD
          </div>
          
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors mt-auto"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        <span className="font-bold text-xl tracking-tight">SQD+BDO</span>
        <button
          onClick={() => setIsCompact(true)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title="Collapse sidebar"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Admin-only: Session Management Section */}
        {isAdmin && (
          <div className="border-b-2 border-indigo-100 bg-indigo-50/50">
            <div className="px-4 py-3 flex items-center justify-between font-semibold text-indigo-900">
              <div className="flex items-center gap-2">
                <Shield size={18} />
                Admin
              </div>
              <span className="text-xs font-normal text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                {sessions.length}
              </span>
            </div>
            
            {/* Create New Session */}
            <div className="px-4 pb-3">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="New session name..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                />
                <button
                  onClick={handleCreateSession}
                  disabled={isCreating || !newSessionName.trim()}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={18} />
                </button>
              </div>
              
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requirePassword}
                  onChange={(e) => setRequirePassword(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                Require password for players
              </label>
            </div>

            {/* Recent Session List */}
            <div className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Recent Sessions
            </div>
            <div className="px-2 pb-0 max-h-48 overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 italic">
                  No sessions yet. Create one above.
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSessionClick(session.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                      currentSession?.id === session.id
                        ? 'bg-indigo-100 text-indigo-900'
                        : 'hover:bg-white text-gray-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{session.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <span className="font-mono">{session.id}</span>
                        {session.has_password && <Lock size={10} />}
                        {session.onboarding_completed && <span>✓</span>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onExportSession) onExportSession('zip');
                        }}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                        title="Export"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Admin-only: Session Control */}
        {isAdmin && currentSession && (
          <div className="border-b border-gray-200 bg-white">
            <div className="px-4 py-3 flex items-center justify-between font-semibold text-gray-900">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-indigo-600" />
                Session Control
              </div>
              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {visibleConnections.length} live
              </span>
            </div>

            <div className="px-3 pb-3">
              <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Shared Timer
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Everyone in this session can set, start, pause, and reset the timer.
                </p>
              </div>

              {visibleConnections.length === 0 ? (
                <div className="px-3 py-3 text-sm text-gray-500 bg-gray-50 rounded-lg">
                  No other active players right now.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {visibleConnections.map((entry) => (
                    <div
                      key={entry.connectionId}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                        entry.isActive 
                          ? 'bg-gray-50 border-gray-100' 
                          : 'bg-gray-100/60 border-gray-200 opacity-60'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                          style={{ backgroundColor: entry.color }}
                          title={entry.name}
                        >
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                            entry.isActive
                              ? 'bg-green-500 animate-pulse'
                              : 'bg-gray-400'
                          }`}
                          title={entry.isActive ? 'Active' : 'Inactive'}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {entry.name}
                          {!entry.isActive && (
                            <span className="ml-1.5 text-[10px] font-normal text-gray-400">(inactive)</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono truncate">
                          {entry.userId || 'no-user-id'}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono truncate">
                          {entry.connectionId}
                        </div>
                      </div>
                      {onKickUser && (
                        <button
                          onClick={() => onKickUser(entry.connectionId, entry.userId)}
                          className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                          title="Disconnect player"
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  Debug trace
                </div>
                <div className="text-xs text-gray-600 font-mono whitespace-pre-wrap break-words">
                  {presenceDebug || 'No debug info yet'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Session Info (for players) */}
        {!isAdmin && currentSession && (
          <div className="border-b-2 border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">Current Session</span>
              {currentSession.has_password ? (
                <Lock size={14} className="text-gray-400" />
              ) : (
                <Unlock size={14} className="text-green-500" />
              )}
            </div>
            <div className="font-semibold text-gray-900">{currentSession.name}</div>
            <div className="text-xs text-gray-500 font-mono">{currentSession.id}</div>
            
            {!isEditMode && onEditRequest && (
              <button
                onClick={onEditRequest}
                className="mt-3 w-full px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Unlock size={14} />
                {currentSession.has_password ? 'Enter Password to Edit' : 'Start Editing'}
              </button>
            )}
            
            {isEditMode && (
              <div className="mt-3 px-3 py-2 bg-green-100 text-green-800 text-sm rounded-lg flex items-center justify-center gap-2">
                <Unlock size={14} />
                Editing Enabled
              </div>
            )}
          </div>
        )}
        
        {/* Workshop navigation */}
        <div>
          <div className="px-4 py-2 flex items-center justify-between font-semibold bg-indigo-50 text-indigo-900 border-b border-gray-100 cursor-pointer">
            Workshops <ChevronDown size={16} />
          </div>
          <div className="bg-gray-50 py-2">
            <div className="px-8 py-1.5 text-sm font-medium text-gray-900">Beyond BulletPoints</div>
          </div>
        </div>
        
        {/* AI Model Selector */}
        <div className="px-4 py-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            <Cpu size={14} /> AI Model
          </div>
          <div className="relative">
            <select 
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value as ModelType)}
              className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 pl-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
            >
              <option value="kimi-k2.6">Kimi K2.6</option>
              <option value="mimo-v2.5">Mimo V2.5</option>
              <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
              <option value="minimax-m3">MiniMax M3</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {/* Logout button (admin only) */}
        {isAdmin && onLogout && (
          <div className="px-4 py-4 border-t border-gray-200">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
