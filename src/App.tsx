/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import RightPanel from './components/RightPanel';
import NewProject from './components/NewProject';
import Canvas from './components/Canvas';
import LoginPage from './components/LoginPage';
import SessionPasswordWall from './components/SessionPasswordWall';
import { UserProfilePrompt, UserProfile } from './components/UserProfilePrompt';
import { ActiveUsers, ConnectionStatus } from './components/UserPresence';
import { usePartyKit } from './hooks/usePartyKit';
import type { CardDraft, LiveConnection } from '../party/index';
import { CardData, ConnectionData, ProjectAttachment, SessionNote } from './types';
import { generateBriefFromUploadsStream, generateCards, ModelType } from './services/ai';
import type { ProjectBackgroundApplyMode } from './components/chat/types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import type { TutorialItem } from './tutorials';
import { apiUrl } from './config/api';
import { ACT1_SECTION_IDS } from './config/canvasSections';
import { useConfirmDialog } from './components/ConfirmDialog';
import type { TimerControlMode } from './config/timer';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

// Session types
interface Session {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  project_client?: string;
  project_background?: string;
  project_notes?: string;
  onboarding_completed: boolean;
  has_password: boolean;
  timer_control_mode: TimerControlMode;
  partykit_session_token?: string;
}

// Main App Component with Router
export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

// Routes Component
function AppRoutes() {
  const { isAdminVerified, isCheckingAuth } = useAuth();

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium text-gray-700">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAdminVerified ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage />
          )
        }
      />

      <Route
        path="/"
        element={
          isAdminVerified ? (
            <Dashboard />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/:sessionId"
        element={<SessionView />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Admin Dashboard Component
function Dashboard() {
  const { adminSessionId, logout, handleExpiredAdminSession } = useAuth();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirmDialog();
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [newSessionInfo, setNewSessionInfo] = useState<{id: string, name: string, password: string | null} | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [sessionPasswords, setSessionPasswords] = useState<Record<string, string>>(() => {
    const stored = localStorage.getItem('sessionPasswords');
    return stored ? JSON.parse(stored) : {};
  });

  useEffect(() => {
    localStorage.setItem('sessionPasswords', JSON.stringify(sessionPasswords));
  }, [sessionPasswords]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/sessions'), {
        headers: { 'x-admin-session': adminSessionId! }
      });

      if (response.status === 401) {
        await handleExpiredAdminSession();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setAllSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }, [adminSessionId, handleExpiredAdminSession]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const createSession = async (name: string, requirePassword: boolean) => {
    try {
      const response = await fetch(apiUrl('/api/sessions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-session': adminSessionId!
        },
        body: JSON.stringify({ name, require_password: requirePassword })
      });

      if (response.status === 401) {
        await handleExpiredAdminSession();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        await loadSessions();

        setNewSessionInfo({
          id: data.session.id,
          name: data.session.name,
          password: data.session.password
        });

        if (data.session.password) {
          setSessionPasswords(prev => ({
            ...prev,
            [data.session.id]: data.session.password
          }));
        }
      } else {
        const errorData = await response.json();
        showToast(errorData.error || 'Failed to create session');
      }
    } catch (error) {
      console.error('Error creating session:', error);
      showToast('Failed to create session');
    }
  };

  const deleteSession = async (sessionId: string) => {
    const confirmed = await confirm({
      title: 'Delete session?',
      message: 'This will permanently delete the session, its cards, connections, notes, and uploaded metadata.',
      confirmLabel: 'Delete session',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}`), {
        method: 'DELETE',
        headers: { 'x-admin-session': adminSessionId! }
      });

      if (response.status === 401) {
        await handleExpiredAdminSession();
        return;
      }

      if (response.ok) {
        await loadSessions();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {dialog}
      <Sidebar
        onViewChange={() => {}}
        currentView="new"
        selectedModel="kimi-k2.6"
        onModelChange={() => {}}
        sessions={allSessions}
        onCreateSession={createSession}
        onDeleteSession={deleteSession}
        onLoadSession={(sessionId) => navigate(`/${sessionId}`)}
        onLogout={logout}
        isAdmin={true}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar projectName="Admin Dashboard" />
        <div className="flex flex-1 overflow-hidden relative">
          <main className="flex-1 overflow-auto relative bg-gray-50/30 p-8">
            {toastMessage && (
              <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-red-500 text-white px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-2">
                <span>{toastMessage}</span>
                <button onClick={() => setToastMessage(null)} className="ml-2 opacity-80 hover:opacity-100">&times;</button>
              </div>
            )}

            {newSessionInfo && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                  <div className="bg-green-600 px-6 py-4">
                    <h2 className="text-xl font-bold text-white">Session Created!</h2>
                  </div>
                  <div className="p-6">
                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-700">Session Name</label>
                      <div className="text-lg font-semibold">{newSessionInfo.name}</div>
                    </div>

                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-700">Session URL</label>
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 px-3 py-2 rounded text-sm flex-1 font-mono">
                          /{newSessionInfo.id}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/${newSessionInfo.id}`);
                            showToast('URL copied to clipboard!');
                          }}
                          className="px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    {newSessionInfo.password && (
                      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <label className="text-sm font-medium text-yellow-800 block mb-1">Session Password</label>
                        <div className="flex items-center gap-2">
                          <code className="bg-white px-3 py-2 rounded text-lg font-mono font-bold text-yellow-900 flex-1">
                            {newSessionInfo.password}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(newSessionInfo.password!);
                              showToast('Password copied to clipboard!');
                            }}
                            className="px-3 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="text-xs text-yellow-700 mt-2">
                          Share this password with players who need to edit the session.
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => setNewSessionInfo(null)}
                        className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                      >
                        Stay Here
                      </button>
                      <a
                        href={`/${newSessionInfo.id}`}
                        className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-center"
                      >
                        Open Session &rarr;
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">All Sessions ({allSessions.length})</h2>

              {allSessions.length === 0 ? (
                <p className="text-gray-500">No sessions yet. Create one from the sidebar.</p>
              ) : (
                <div className="grid gap-4">
                  {allSessions.map(session => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{session.name}</div>
                        <div className="text-sm text-gray-500 font-mono">{session.id}</div>
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                          {session.has_password ? (
                            <>
                              <span className="flex items-center gap-1">
                                Password protected
                                {sessionPasswords[session.id] ? (
                                  <>
                                    <span className="font-mono bg-gray-200 px-2 py-0.5 rounded">
                                      {visiblePasswords[session.id]
                                        ? sessionPasswords[session.id]
                                        : '••••••••'
                                      }
                                    </span>
                                    <button
                                      onClick={() => {
                                        setVisiblePasswords(prev => ({
                                          ...prev,
                                          [session.id]: !prev[session.id]
                                        }));
                                      }}
                                      className="text-indigo-600 hover:text-indigo-800 text-xs underline ml-1"
                                    >
                                      {visiblePasswords[session.id] ? 'Hide' : 'Show'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(sessionPasswords[session.id]);
                                        showToast('Password copied!');
                                      }}
                                      className="text-gray-500 hover:text-gray-700 text-xs ml-1"
                                      title="Copy password"
                                    >
                                      Copy
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-gray-400 italic">(Password not stored - create a new session to see passwords)</span>
                                )}
                              </span>
                            </>
                          ) : (
                            <span>Open session</span>
                          )}
                          <span>&bull;</span>
                          <span>{session.onboarding_completed ? 'Ready' : 'Onboarding'}</span>
                          <span>&bull;</span>
                          <span className="text-xs text-gray-500">Timer shared</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/${session.id}`}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                        >
                          Open
                        </a>
                        <button
                          onClick={() => deleteSession(session.id)}
                          className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
              <h3 className="font-semibold text-indigo-900 mb-2">Quick Tips</h3>
              <ul className="text-sm text-indigo-800 space-y-1">
                <li>Create sessions from the sidebar with optional passwords</li>
                <li>Click "Open" to start the onboarding process</li>
                <li>Share session URLs with players: website.com/bdo-xxxx</li>
                <li>Sessions with passwords require players to enter it before viewing content</li>
              </ul>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// Session View Component (for both admin and players)
function SessionView() {
  const { isAdminVerified, isCheckingAuth, adminSessionId, handleExpiredAdminSession } = useAuth();
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { confirm, dialog } = useConfirmDialog();

  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [liveCardDrafts, setLiveCardDrafts] = useState<Record<string, CardDraft>>({});
  const [savingCardIds, setSavingCardIds] = useState<Set<string>>(() => new Set());
  const savingCardIdsRef = useRef(savingCardIds);
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPasswordWall, setShowPasswordWall] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [projectData, setProjectData] = useState({ client: '', background: '', notes: '' });
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelType>('kimi-k2.6');
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [isGeneratingBriefFromUploads, setIsGeneratingBriefFromUploads] = useState(false);
  const briefGenerationAbortRef = useRef<AbortController | null>(null);
  const [isSavingProjectChanges, setIsSavingProjectChanges] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingCards, setIsRegeneratingCards] = useState(false);
  const [generatingSections, setGeneratingSections] = useState<string[]>([]);
  const [workspaceView, setWorkspaceView] = useState<'brief' | 'canvas'>('canvas');
  const [isRightPanelCompact, setIsRightPanelCompact] = useState(() => {
    const stored = localStorage.getItem('bbp_right_panel_compact');
    return stored ? stored === 'true' : false;
  });
  const [activeTutorial, setActiveTutorial] = useState<TutorialItem | null>(null);
  const [adminPartyKitToken, setAdminPartyKitToken] = useState<string | null>(null);
  const [adminSessions, setAdminSessions] = useState<Session[]>([]);
  const [presenceDebug, setPresenceDebug] = useState<string>('Presence not loaded yet');

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setLiveCardDrafts((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [cardId, draft] of Object.entries(prev)) {
          if (now - draft.timestamp > 8000) {
            delete next[cardId];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 4000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAiConfig = async () => {
      try {
        const response = await fetch(apiUrl('/api/ai/config'));
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && typeof data.defaultModel === 'string' && data.defaultModel.trim()) {
          setSelectedModel(data.defaultModel);
        }
      } catch (error) {
        console.warn('Failed to load AI config:', error);
      }
    };

    loadAiConfig();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    localStorage.setItem('bbp_right_panel_compact', String(isRightPanelCompact));
  }, [isRightPanelCompact]);

  useEffect(() => {
    if (isAdminVerified) {
      const existingProfile = localStorage.getItem('bbp_user_profile');
      let adminProfile: UserProfile;
      if (existingProfile) {
        try {
          const parsed = JSON.parse(existingProfile);
          if (parsed.id && parsed.id.startsWith('admin_')) {
            adminProfile = parsed;
          } else {
            adminProfile = {
              id: 'admin_' + Math.random().toString(36).substr(2, 9),
              name: 'Admin',
              color: '#EF4444',
            };
          }
        } catch {
          adminProfile = {
            id: 'admin_' + Math.random().toString(36).substr(2, 9),
            name: 'Admin',
            color: '#EF4444',
          };
        }
      } else {
        adminProfile = {
          id: 'admin_' + Math.random().toString(36).substr(2, 9),
          name: 'Admin',
          color: '#EF4444',
        };
      }
      localStorage.setItem('bbp_user_profile', JSON.stringify(adminProfile));
      localStorage.setItem('bbp_user_id', adminProfile.id);
      setUserProfile(adminProfile);
    } else {
      const storedProfile = localStorage.getItem('bbp_user_profile');
      if (storedProfile) {
        try {
          const parsed = JSON.parse(storedProfile);
          if (parsed?.id?.startsWith('admin_')) {
            localStorage.removeItem('bbp_user_profile');
            localStorage.removeItem('bbp_user_id');
            setUserProfile(null);
            setShowProfilePrompt(true);
          } else {
            setUserProfile(parsed);
          }
        } catch (e) {
          localStorage.removeItem('bbp_user_profile');
          localStorage.removeItem('bbp_user_id');
          setUserProfile(null);
          setShowProfilePrompt(true);
        }
      } else {
        setUserProfile(null);
        setShowProfilePrompt(true);
      }
    }
  }, [isAdminVerified]);

  const handleExitSession = () => {
    localStorage.removeItem('bbp_user_profile');
    localStorage.removeItem('bbp_user_id');
    window.location.href = '/';
  };

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  }, []);

  useEffect(() => {
    savingCardIdsRef.current = savingCardIds;
  }, [savingCardIds]);

  const mergeSessionCards = useCallback((incomingCards: CardData[]) => {
    setCards((prevCards) => {
      const pendingCardIds = savingCardIdsRef.current;
      if (pendingCardIds.size === 0) return incomingCards;

      const pendingCards = new Map(
        prevCards
          .filter((card) => pendingCardIds.has(card.id))
          .map((card) => [card.id, card])
      );

      return incomingCards.map((card) => pendingCards.get(card.id) ?? card);
    });
  }, []);

  const getGuestEditPassword = useCallback(() => {
    if (!sessionId || isAdminVerified) return undefined;
    return sessionStorage.getItem(`session_${sessionId}_password`) || undefined;
  }, [isAdminVerified, sessionId]);

  const getEditRequestBody = useCallback(<T extends object>(body: T): T & { edit_password?: string } => {
    const editPassword = getGuestEditPassword();
    return editPassword ? { ...body, edit_password: editPassword } : body;
  }, [getGuestEditPassword]);

  const getEditRequestHeaders = useCallback((headers: Record<string, string> = {}) => {
    const editPassword = getGuestEditPassword();
    return {
      ...headers,
      ...(isAdminVerified && adminSessionId ? { 'x-admin-session': adminSessionId } : {}),
      ...(!isAdminVerified && editPassword ? { 'x-session-password': editPassword } : {}),
    };
  }, [adminSessionId, getGuestEditPassword, isAdminVerified]);

  const loadAdminSessions = useCallback(async () => {
    if (!isAdminVerified || !adminSessionId) {
      setAdminSessions([]);
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/sessions'), {
        headers: { 'x-admin-session': adminSessionId },
      });

      if (response.status === 401) {
        await handleExpiredAdminSession();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setAdminSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading admin sessions:', error);
    }
  }, [adminSessionId, handleExpiredAdminSession, isAdminVerified]);

  useEffect(() => {
    loadAdminSessions();
  }, [loadAdminSessions]);

  useEffect(() => {
    if (!isAdminVerified || !adminSessionId || !sessionId) {
      setAdminPartyKitToken(null);
      return;
    }

    const fetchAdminToken = async () => {
      try {
        const response = await fetch(apiUrl('/api/admin/partykit-token'), {
          method: 'POST',
          headers: { 'x-admin-session': adminSessionId },
        });

        if (response.status === 401) {
          await handleExpiredAdminSession();
          setAdminPartyKitToken(null);
          return;
        }

        if (!response.ok) {
          const errorText = await response.text();
          setPresenceDebug(`Realtime auth error: ${response.status} ${errorText}`);
          setAdminPartyKitToken(null);
          return;
        }

        const data = await response.json();
        setAdminPartyKitToken(data.token || null);
      } catch (error) {
        console.error('Error getting PartyKit admin token:', error);
        setPresenceDebug(`Realtime auth error: ${error instanceof Error ? error.message : 'unknown error'}`);
        setAdminPartyKitToken(null);
      }
    };

    fetchAdminToken();
    const refreshInterval = window.setInterval(fetchAdminToken, 12 * 60 * 1000);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, [adminSessionId, isAdminVerified, handleExpiredAdminSession, sessionId]);

  const shouldConnectPartyKit = !!sessionId && !!currentSession && !!userProfile && !isCheckingAuth && !showPasswordWall;
  const canConnectPartyKit = shouldConnectPartyKit && (!isAdminVerified || !!adminPartyKitToken);
  const partySessionId = shouldConnectPartyKit ? sessionId : null;
  const partyUserId = userProfile?.id || '';
  const partyUserName = userProfile?.name || '';
  const partyUserColor = userProfile?.color || '#3B82F6';

  const {
    isConnected,
    isConnecting,
    users: activeUsers,
    liveConnections,
    timerState,
    currentConnectionId,
    connectionRole,
    error: partyKitError,
    sendCardCreate,
    sendCardUpdate,
    sendCardDraft,
    sendCardDelete,
    sendCardReorder,
    sendConnectionCreate,
    sendConnectionDelete,
    sendCursorMove,
    sendPresenceUpdate,
    sendAdminKick,
    sendProjectUpdate,
    sendNoteUpdate,
    sendTimerCommand,
  } = usePartyKit({
    sessionId: canConnectPartyKit ? partySessionId : null,
    userId: partyUserId,
    userName: partyUserName,
    userColor: partyUserColor,
    adminToken: adminPartyKitToken,
    sessionSettingsToken: currentSession?.partykit_session_token ?? null,
    onCardCreate: (card) => {
      setCards((prev) => {
        if (prev.find((c) => c.id === card.id)) return prev;
        return [...prev, card];
      });
      showToast(`${card.section}: New card added by collaborator`);
    },
    onCardUpdate: (cardId, updates) => {
      if (savingCardIdsRef.current.has(cardId)) return;
      setLiveCardDrafts((prev) => {
        if (!prev[cardId]) return prev;
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
      setCards((prev) =>
        prev.map((card) =>
          card.id === cardId ? { ...card, ...updates } : card
        )
      );
    },
    onCardDraft: (draft) => {
      setLiveCardDrafts((prev) => {
        if (!draft.isActive) {
          if (!prev[draft.cardId]) return prev;
          const next = { ...prev };
          delete next[draft.cardId];
          return next;
        }

        return {
          ...prev,
          [draft.cardId]: draft,
        };
      });
    },
    onCardDelete: (cardId) => {
      setLiveCardDrafts((prev) => {
        if (!prev[cardId]) return prev;
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
      setCards((prev) => prev.filter((card) => card.id !== cardId));
      setConnections((prev) =>
        prev.filter((conn) => conn.from !== cardId && conn.to !== cardId)
      );
    },
    onUserLeave: (userId) => {
      setLiveCardDrafts((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [cardId, draft] of Object.entries(prev)) {
          if (draft.userId === userId) {
            delete next[cardId];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    onCardReorder: (section, cardIds) => {
      setCards((prev) => {
        const sectionCards = prev.filter((c) => c.section === section);
        const otherCards = prev.filter((c) => c.section !== section);
        const reordered = cardIds
          .map((id) => sectionCards.find((c) => c.id === id))
          .filter(Boolean) as CardData[];
        return [...otherCards, ...reordered];
      });
    },
    onConnectionCreate: (connection) => {
      setConnections((prev) => {
        if (prev.find((c) => c.id === connection.id)) return prev;
        return [...prev, connection];
      });
    },
    onConnectionDelete: (connectionId) => {
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    },
    onProjectUpdate: (updates) => {
      setCurrentSession((prev) => prev ? {
        ...prev,
        ...(updates.project_client !== undefined ? { project_client: updates.project_client } : {}),
        ...(updates.project_background !== undefined ? { project_background: updates.project_background } : {}),
        ...(updates.project_notes !== undefined ? { project_notes: updates.project_notes } : {}),
      } : prev);
      setProjectData((prev) => ({
        client: updates.project_client ?? prev.client,
        background: updates.project_background ?? prev.background,
        notes: updates.project_notes ?? prev.notes,
      }));
    },
    onNoteUpdate: (note) => {
      setSessionNotes((prev) => {
        const index = prev.findIndex((existing) => existing.id === note.id);
        if (index === -1) return [...prev, note];
        return prev.map((existing) => existing.id === note.id ? note : existing);
      });
    },
    onKicked: (message) => {
      showToast(message);
      setPresenceDebug(message);
    },
  });

  const handleProfileSubmit = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('bbp_user_profile', JSON.stringify(profile));
    localStorage.setItem('bbp_user_id', profile.id);
    setShowProfilePrompt(false);
  };

  useEffect(() => {
    if (isConnected && userProfile && sendPresenceUpdate) {
      sendPresenceUpdate({
        id: userProfile.id,
        name: userProfile.name,
        color: userProfile.color,
        lastActive: Date.now(),
      });
    }
  }, [isConnected, userProfile, sendPresenceUpdate]);

  useEffect(() => {
    if (partyKitError?.message) {
      setPresenceDebug(partyKitError.message);
      return;
    }

    if (isAdminVerified) {
      if (connectionRole === 'admin') {
        setPresenceDebug(`PartyKit live room state: ${liveConnections.length} connected entities`);
      } else if (adminPartyKitToken && connectionRole === 'participant') {
        setPresenceDebug('Admin realtime auth failed; connected without session control privileges');
      } else if (isConnecting) {
        setPresenceDebug('Connecting to PartyKit room...');
      }
      return;
    }

    if (isConnected) {
      setPresenceDebug(`PartyKit live room state: ${liveConnections.length} connected entities`);
    }
  }, [adminPartyKitToken, connectionRole, isAdminVerified, isConnected, isConnecting, liveConnections.length, partyKitError]);

  useEffect(() => {
    if (!isAdminVerified || !currentSession) return;
    setShowPasswordWall(false);
    setIsEditMode(true);
  }, [currentSession, isAdminVerified]);

  const handleCreateAdminSession = useCallback(async (name: string, requirePassword: boolean) => {
    if (!isAdminVerified || !adminSessionId) return;

    try {
      const response = await fetch(apiUrl('/api/sessions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-session': adminSessionId,
        },
        body: JSON.stringify({ name, require_password: requirePassword }),
      });

      if (response.status === 401) {
        await handleExpiredAdminSession();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        await loadAdminSessions();
        if (data.session?.id) {
          navigate(`/${data.session.id}`);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        showToast(errorData.error || 'Failed to create session');
      }
    } catch (error) {
      console.error('Error creating session:', error);
      showToast('Failed to create session');
    }
  }, [adminSessionId, handleExpiredAdminSession, isAdminVerified, loadAdminSessions, navigate]);

  const handleDeleteAdminSession = useCallback(async (targetSessionId: string) => {
    if (!isAdminVerified || !adminSessionId) return;

    const confirmed = await confirm({
      title: 'Delete session?',
      message: 'This will permanently delete the session, its cards, connections, notes, and uploaded metadata.',
      confirmLabel: 'Delete session',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      const response = await fetch(apiUrl(`/api/sessions/${targetSessionId}`), {
        method: 'DELETE',
        headers: { 'x-admin-session': adminSessionId },
      });

      if (response.status === 401) {
        await handleExpiredAdminSession();
        return;
      }

      if (response.ok) {
        await loadAdminSessions();
        if (targetSessionId === sessionId) {
          navigate('/');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        showToast(errorData.error || 'Failed to delete session');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      showToast('Failed to delete session');
    }
  }, [adminSessionId, confirm, handleExpiredAdminSession, isAdminVerified, loadAdminSessions, navigate, sessionId]);

  const loadAttachments = useCallback(async (targetSessionId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/sessions/${targetSessionId}/attachments`), {
        headers: getEditRequestHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setAttachments(data.attachments || []);
      } else if (response.status === 403 || response.status === 401) {
        setAttachments([]);
      }
    } catch (error) {
      console.error('Error loading attachments:', error);
    }
  }, [getEditRequestHeaders]);

  const loadNotes = useCallback(async (targetSessionId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/sessions/${targetSessionId}/notes`));
      if (response.ok) {
        const data = await response.json();
        setSessionNotes(data.notes || []);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  }, []);

  const handleUpdateSessionNote = useCallback(async (note: SessionNote) => {
    if (!sessionId || (!isAdminVerified && !isEditMode)) {
      return;
    }

    const response = await fetch(apiUrl(`/api/sessions/${sessionId}/notes/${encodeURIComponent(note.id)}`), {
      method: 'PUT',
      headers: getEditRequestHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(getEditRequestBody({
        title: note.title,
        content: note.content,
        createdBy: note.createdBy,
      })),
    });

    if (!response.ok) {
      throw new Error('Failed to save notes');
    }

    const data = await response.json();
    setSessionNotes((prev) => {
      const index = prev.findIndex((existing) => existing.id === data.note.id);
      if (index === -1) return [...prev, data.note];
      return prev.map((existing) => existing.id === data.note.id ? data.note : existing);
    });
    sendNoteUpdate(data.note);
  }, [getEditRequestBody, getEditRequestHeaders, isAdminVerified, isEditMode, sendNoteUpdate, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    setWorkspaceView('canvas');

    const loadSession = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(apiUrl(`/api/sessions/${sessionId}`));
        if (response.ok) {
          const data = await response.json();
          setCurrentSession(data.session);

          if (isAdminVerified) {
            setShowPasswordWall(false);
            setIsEditMode(true);
            mergeSessionCards(data.cards || []);
            setLiveCardDrafts({});
            setConnections(data.connections || []);
            await loadAttachments(sessionId);
            await loadNotes(sessionId);
            setProjectData({
              client: data.session.project_client || data.session.name || '',
              background: data.session.project_background || '',
              notes: data.session.project_notes || ''
            });
          } else {
            if (data.session.has_password) {
              const savedPassword = sessionStorage.getItem(`session_${sessionId}_password`);
              if (savedPassword) {
                const verifyResponse = await fetch(apiUrl(`/api/sessions/${sessionId}/verify`), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password: savedPassword })
                });
                if (verifyResponse.ok) {
                  const { valid } = await verifyResponse.json();
                  if (valid) {
                    setShowPasswordWall(false);
                    setIsEditMode(true);
                    mergeSessionCards(data.cards || []);
                    setLiveCardDrafts({});
                    setConnections(data.connections || []);
                    await loadAttachments(sessionId);
                    await loadNotes(sessionId);
                    setProjectData({
                      client: data.session.project_client || data.session.name || '',
                      background: data.session.project_background || '',
                      notes: data.session.project_notes || ''
                    });
                  } else {
                    setShowPasswordWall(true);
                  }
                } else {
                  setShowPasswordWall(true);
                }
              } else {
                setShowPasswordWall(true);
              }
            } else {
              setShowPasswordWall(false);
              setIsEditMode(true);
              mergeSessionCards(data.cards || []);
              setLiveCardDrafts({});
              setConnections(data.connections || []);
              await loadAttachments(sessionId);
              await loadNotes(sessionId);
              setProjectData({
                client: data.session.project_client || data.session.name || '',
                background: data.session.project_background || '',
                notes: data.session.project_notes || ''
              });
            }
          }
        } else {
          showToast('Session not found');
        }
      } catch (error) {
        console.error('Error loading session:', error);
        showToast('Failed to load session');
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [sessionId, isAdminVerified, adminSessionId, loadAttachments, loadNotes, mergeSessionCards]);

  useEffect(() => {
    if (!sessionId || isAdminVerified) return;
    if (currentSession?.onboarding_completed) return;
    if (showPasswordWall) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(apiUrl(`/api/sessions/${sessionId}`));
        if (response.ok) {
          const data = await response.json();
          setCurrentSession(data.session);

          if (data.session.onboarding_completed && !currentSession?.onboarding_completed) {
            mergeSessionCards(data.cards || []);
            setLiveCardDrafts({});
            setConnections(data.connections || []);
            await loadAttachments(sessionId);
            await loadNotes(sessionId);
            setProjectData({
              client: data.session.project_client || data.session.name || '',
              background: data.session.project_background || '',
              notes: data.session.project_notes || ''
            });
            showToast('Session is ready! The facilitator has completed setup.');
          }
        }
      } catch (error) {
        console.error('Error polling session:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, isAdminVerified, currentSession?.onboarding_completed, showPasswordWall, loadAttachments, loadNotes, mergeSessionCards]);

  const verifyPassword = async (password: string): Promise<boolean> => {
    if (!sessionId) return false;

    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}/verify`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        const { valid } = await response.json();
        if (valid) {
          setIsEditMode(true);
          setShowPasswordWall(false);
          sessionStorage.setItem(`session_${sessionId}_password`, password);

          const sessionResponse = await fetch(apiUrl(`/api/sessions/${sessionId}`));
          if (sessionResponse.ok) {
            const data = await sessionResponse.json();
            mergeSessionCards(data.cards || []);
            setLiveCardDrafts({});
            setConnections(data.connections || []);
            await loadAttachments(sessionId);
            await loadNotes(sessionId);
            setProjectData({
              client: data.session.project_client || data.session.name || '',
              background: data.session.project_background || '',
              notes: data.session.project_notes || ''
            });
          }
        }
        return valid;
      }
      return false;
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  };

  const handleKickUser = async (connectionId: string, userId?: string | null) => {
    if (!isAdminVerified || connectionRole !== 'admin') return;
    sendAdminKick(connectionId, userId);
    showToast('Disconnect request sent');
  };

  const completeOnboarding = async () => {
    if (!sessionId || !isAdminVerified) return;

    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}/complete-onboarding`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-session': adminSessionId || ''
        }
      });

      if (response.ok) {
        setCurrentSession(prev => prev ? { ...prev, onboarding_completed: true } : null);
        setWorkspaceView('canvas');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const saveProjectMetadata = async () => {
    if (!sessionId || (!isAdminVerified && !isEditMode)) return;

    const nextClient = projectData.client || currentSession?.name || '';
    const response = await fetch(apiUrl(`/api/sessions/${sessionId}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(isAdminVerified && adminSessionId ? { 'x-admin-session': adminSessionId } : {}),
      },
      body: JSON.stringify(getEditRequestBody({
        project_client: nextClient,
        project_background: projectData.background,
        project_notes: projectData.notes,
      })),
    });

    if (!response.ok) {
      throw new Error('Failed to save project changes');
    }

    setCurrentSession((prev) => prev ? {
      ...prev,
      project_client: nextClient,
      project_background: projectData.background,
      project_notes: projectData.notes,
    } : prev);
  };

  const handleSaveProjectChanges = async () => {
    setIsSavingProjectChanges(true);
    try {
      await saveProjectMetadata();
      showToast('Project brief saved');
    } catch (error: any) {
      console.error('Error saving project changes:', error);
      showToast(error.message || 'Failed to save project changes');
    } finally {
      setIsSavingProjectChanges(false);
    }
  };

  const handleUpdateProjectBackground = async (background: string) => {
    if (!sessionId || (!isAdminVerified && !isEditMode)) return;

    const nextClient = projectData.client || currentSession?.name || '';
    const response = await fetch(apiUrl(`/api/sessions/${sessionId}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(isAdminVerified && adminSessionId ? { 'x-admin-session': adminSessionId } : {}),
      },
      body: JSON.stringify(getEditRequestBody({
        project_client: nextClient,
        project_background: background,
        project_notes: projectData.notes,
      })),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to save project overview' }));
      showToast(errorData.error || 'Failed to save project overview');
      throw new Error(errorData.error || 'Failed to save project overview');
    }

    setProjectData((prev) => ({ ...prev, client: nextClient, background }));
    setCurrentSession((prev) => prev ? {
      ...prev,
      project_client: nextClient,
      project_background: background,
      project_notes: projectData.notes,
    } : prev);
    sendProjectUpdate({
      project_client: nextClient,
      project_background: background,
      project_notes: projectData.notes,
    });
    showToast('Project overview saved');
  };

  const generateAndSaveCardsBySection = async (background: string, seedCards: CardData[] = []) => {
    console.log('[App] generateAndSaveCardsBySection START:', { backgroundLength: background.length, seedCardsCount: seedCards.length, client: projectData.client || currentSession?.name || 'Unknown' });
    setGeneratingSections([...ACT1_SECTION_IDS]);

    try {
      const generatedCards = await generateCards(
        projectData.client || currentSession?.name || '',
        background,
        projectData.notes,
        selectedModel
      );

      console.log('[App] generateAndSaveCardsBySection: bulk generated', generatedCards.length, 'cards');
      await createGeneratedCards(generatedCards);
      console.log('[App] generateAndSaveCardsBySection: ALL SECTIONS SUCCESS');
    } catch (error) {
      console.error('[App] generateAndSaveCardsBySection: bulk generation failed', error);
      throw error;
    } finally {
      setGeneratingSections([]);
    }
  };

  const handleRegenerateCards = async (backgroundOverride?: string) => {
    if (!sessionId || (!isAdminVerified && !isEditMode)) return;

    const confirmed = await confirm({
      title: 'Regenerate cards?',
      message: 'This will delete the existing canvas cards and connections before creating a new generated set from the current brief.',
      confirmLabel: 'Regenerate cards',
      tone: 'warning',
    });
    if (!confirmed) return;

    setIsRegeneratingCards(true);
    setGeneratingSections([]);
    try {
      const nextBackground = backgroundOverride ?? projectData.background;
      if (backgroundOverride !== undefined) {
        await handleUpdateProjectBackground(nextBackground);
      } else {
        await saveProjectMetadata();
      }

      for (const card of cards) {
        const response = await fetch(apiUrl(`/api/sessions/${sessionId}/cards/${card.id}`), {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(isAdminVerified && adminSessionId ? { 'x-admin-session': adminSessionId } : {}),
          },
          body: JSON.stringify(getEditRequestBody({})),
        });

        if (!response.ok) {
          throw new Error('Failed to delete existing cards');
        }

        sendCardDelete(card.id);
      }

      setCards([]);
      setConnections([]);
      setSelectedCard(null);

      setWorkspaceView('canvas');
      await generateAndSaveCardsBySection(nextBackground);
      showToast('Cards regenerated from updated brief');
    } catch (error: any) {
      console.error('Error regenerating cards:', error);
      showToast(error.message || 'Failed to regenerate cards');
    } finally {
      setGeneratingSections([]);
      setIsRegeneratingCards(false);
    }
  };

  const handleStartProject = async () => {
    if (!sessionId || !isAdminVerified) return;

    if (!currentSession?.name && !projectData.background) {
      await completeOnboarding();
      return;
    }

    setIsGenerating(true);
    setGeneratingSections([]);
    try {
      await saveProjectMetadata();
      await completeOnboarding();
      setWorkspaceView('canvas');
      await generateAndSaveCardsBySection(projectData.background, cards);
    } catch (error: any) {
      console.error("Failed to generate cards", error);
      showToast("Failed to generate cards");
    } finally {
      setGeneratingSections([]);
      setIsGenerating(false);
    }
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || !sessionId || (!isAdminVerified && !isEditMode)) return;

    setIsUploadingAttachments(true);
    try {
      for (const file of Array.from(files)) {
        const directTargetResponse = await fetch(apiUrl(`/api/sessions/${sessionId}/attachments/upload-target`), {
          method: 'POST',
          headers: getEditRequestHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(getEditRequestBody({
            name: file.name,
            mimeType: file.type,
          })),
        });

        if (directTargetResponse.ok) {
          const target = await directTargetResponse.json();
          const uploadResponse = await fetch(target.uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
            },
            body: file,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Upload failed for "${file.name}"`);
          }

          const uploadData = await uploadResponse.json();
          const finalizeResponse = await fetch(apiUrl(`/api/sessions/${sessionId}/attachments/finalize-upload`), {
            method: 'POST',
            headers: getEditRequestHeaders({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify(getEditRequestBody({
              name: file.name,
              mimeType: file.type,
              storageId: uploadData.storageId,
              size: file.size,
            })),
          });

          if (!finalizeResponse.ok) {
            const errorData = await finalizeResponse.json().catch(() => ({ error: 'Upload failed' }));
            throw new Error(errorData.error || `Upload failed for "${file.name}"`);
          }

          const data = await finalizeResponse.json();
          setAttachments((prev) => [data.attachment, ...prev]);
          continue;
        }

        if (![404, 501].includes(directTargetResponse.status)) {
          const errorData = await directTargetResponse.json().catch(() => ({ error: 'Upload failed' }));
          throw new Error(errorData.error || `Upload failed for "${file.name}"`);
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });

        const response = await fetch(apiUrl(`/api/sessions/${sessionId}/attachments`), {
          method: 'POST',
          headers: getEditRequestHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(getEditRequestBody({
            name: file.name,
            mimeType: file.type,
            dataUrl,
          }))
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
          if (response.status === 413) {
            throw new Error(`"${file.name}" is too large to upload right now. Try a smaller file or split it into parts.`);
          }
          throw new Error(errorData.error || `Upload failed for "${file.name}"`);
        }

        const data = await response.json();
        setAttachments((prev) => [data.attachment, ...prev]);
      }

      showToast('Documents uploaded and processed');
    } catch (error: any) {
      console.error('Error uploading files:', error);
      showToast(error.message || 'Failed to upload files');
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const handleUploadSessionArchive = async (file: File | null) => {
    if (!file) return;
    if (!sessionId || (!isAdminVerified && !isEditMode)) return;

    const isZip = file.name.toLowerCase().endsWith('.zip')
      || file.type === 'application/zip'
      || file.type === 'application/x-zip-compressed';

    if (!isZip) {
      showToast('Upload a ZIP session archive');
      return;
    }

    const confirmed = await confirm({
      title: 'Replace this session?',
      message: 'Importing this ZIP will replace the current brief, cards, connections, notes, and attachment metadata.',
      confirmLabel: 'Replace session',
      tone: 'danger',
    });
    if (!confirmed) return;

    setIsUploadingAttachments(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const response = await fetch(apiUrl(`/api/sessions/${sessionId}/import/zip`), {
        method: 'POST',
        headers: getEditRequestHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(getEditRequestBody({
          name: file.name,
          dataUrl,
        })),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to import session ZIP' }));
        throw new Error(errorData.error || 'Failed to import session ZIP');
      }

      const data = await response.json();
      setCurrentSession(data.session);
      mergeSessionCards(data.cards || []);
      setLiveCardDrafts({});
      setConnections(data.connections || []);
      setAttachments(data.attachments || []);
      setSessionNotes(data.notes || []);
      setProjectData({
        client: data.session?.project_client || data.session?.name || '',
        background: data.session?.project_background || '',
        notes: data.session?.project_notes || '',
      });
      setWorkspaceView('canvas');
      showToast('Session ZIP imported');
    } catch (error: any) {
      console.error('Error importing session ZIP:', error);
      showToast(error.message || 'Failed to import session ZIP');
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const handleUseAttachmentText = (attachment: ProjectAttachment, target: 'background' | 'notes', source: 'summary' | 'full') => {
    const content = source === 'summary' ? attachment.summary : attachment.extractedText;

    if (!content.trim()) {
      showToast(source === 'summary' ? 'This file does not have a summary yet' : 'This file does not have extracted text yet');
      return;
    }

    const sourceLabel = source === 'summary' ? 'summary' : 'extracted text';
    const textToInsert = `[Source: ${attachment.name}]\n${content.trim()}`;

    setProjectData((prev) => ({
      ...prev,
      [target]: prev[target].trim()
        ? `${prev[target].trim()}\n\n${textToInsert}`
        : textToInsert,
    }));

    showToast(target === 'background' ? `Added ${sourceLabel} to project overview` : `Added ${sourceLabel} to notes`);
  };

  const handleGenerateBriefFromUploads = async () => {
    if (!sessionId || (!isAdminVerified && !isEditMode)) return;
    if (isGeneratingBriefFromUploads) {
      briefGenerationAbortRef.current?.abort();
      return;
    }

    const usableAttachments = attachments.filter((attachment) =>
      attachment.summary.trim() || attachment.extractedText.trim() || attachment.note?.trim()
    );

    if (usableAttachments.length === 0) {
      showToast('Upload at least one document with extracted text or a summary first');
      return;
    }

    const abortController = new AbortController();
    briefGenerationAbortRef.current = abortController;
    const previousBackground = projectData.background;
    const placeholderBrief = 'Generating project overview';
    let streamedBrief = '';
    let pendingBrief = '';
    let flushTimer: number | null = null;
    let progressTimer: number | null = null;
    let progressStep = 0;
    const flushBrief = () => {
      if (!pendingBrief) return;
      setProjectData((prev) => ({ ...prev, background: pendingBrief }));
      flushTimer = null;
    };
    const showProgress = () => {
      if (streamedBrief) return;
      progressStep += 1;
      const dots = '.'.repeat((progressStep % 3) + 1);
      setProjectData((prev) => ({ ...prev, background: `${placeholderBrief}${dots}` }));
    };

    setIsGeneratingBriefFromUploads(true);
    setProjectData((prev) => ({ ...prev, background: `${placeholderBrief}...` }));
    progressTimer = window.setInterval(showProgress, 350);

    try {
      const brief = await generateBriefFromUploadsStream(
        projectData.client || currentSession?.name || '',
        previousBackground,
        projectData.notes,
        usableAttachments,
        selectedModel,
        (chunk) => {
          if (progressTimer !== null) {
            window.clearInterval(progressTimer);
            progressTimer = null;
          }
          streamedBrief += chunk;
          pendingBrief = streamedBrief;
          if (flushTimer === null) {
            flushTimer = window.setTimeout(flushBrief, 40);
          }
        },
        abortController.signal
      );

      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
        flushTimer = null;
      }

      if (abortController.signal.aborted) {
        if (!streamedBrief.trim()) {
          setProjectData((prev) => ({ ...prev, background: previousBackground }));
        }
        showToast('Stopped project overview generation');
        return;
      }

      const finalBrief = brief.trim();
      setProjectData((prev) => ({ ...prev, background: finalBrief }));

      const response = await fetch(apiUrl(`/api/sessions/${sessionId}`), {
        method: 'PUT',
        headers: getEditRequestHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(getEditRequestBody({
          project_client: projectData.client || currentSession?.name || '',
          project_background: finalBrief,
          project_notes: projectData.notes,
        })),
      });

      if (!response.ok) {
        throw new Error('Generated brief, but could not save it to the session');
      }

      setCurrentSession((prev) => prev ? {
        ...prev,
        project_client: projectData.client || currentSession?.name || '',
        project_background: finalBrief,
        project_notes: projectData.notes,
      } : prev);
      showToast('Generated project overview from uploads');
    } catch (error: any) {
      if (error?.name === 'AbortError' || abortController.signal.aborted) {
        if (!streamedBrief.trim()) {
          setProjectData((prev) => ({ ...prev, background: previousBackground }));
        }
        showToast('Stopped project overview generation');
        return;
      }

      if (!streamedBrief.trim()) {
        setProjectData((prev) => ({ ...prev, background: previousBackground }));
      }
      console.error('Error generating brief from uploads:', error);
      showToast(error.message || 'Could not generate brief from uploads');
    } finally {
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
      }
      if (progressTimer !== null) {
        window.clearInterval(progressTimer);
      }
      if (briefGenerationAbortRef.current === abortController) {
        briefGenerationAbortRef.current = null;
      }
      setIsGeneratingBriefFromUploads(false);
    }
  };

  const handleUpdateAttachmentNote = async (attachmentId: string, note: string) => {
    if (!sessionId || (!isAdminVerified && !isEditMode)) return;

    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}/attachments/${attachmentId}`), {
        method: 'PATCH',
        headers: getEditRequestHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(getEditRequestBody({ note })),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update source note' }));
        throw new Error(errorData.error || 'Failed to update source note');
      }

      const data = await response.json();
      setAttachments((prev) => prev.map((attachment) =>
        attachment.id === attachmentId ? data.attachment : attachment
      ));
    } catch (error: any) {
      console.error('Error updating attachment note:', error);
      showToast(error.message || 'Failed to update source note');
      throw error;
    }
  };

  const handleRenameAttachment = async (attachmentId: string, name: string) => {
    if (!sessionId || (!isAdminVerified && !isEditMode)) return;

    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}/attachments/${attachmentId}`), {
        method: 'PATCH',
        headers: getEditRequestHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(getEditRequestBody({ name })),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to rename upload' }));
        throw new Error(errorData.error || 'Failed to rename upload');
      }

      const data = await response.json();
      setAttachments((prev) => prev.map((attachment) =>
        attachment.id === attachmentId ? data.attachment : attachment
      ));
      showToast('Upload renamed');
    } catch (error: any) {
      console.error('Error renaming attachment:', error);
      showToast(error.message || 'Failed to rename upload');
      throw error;
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!sessionId || (!isAdminVerified && !isEditMode)) return;

    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}/attachments/${attachmentId}`), {
        method: 'DELETE',
        headers: getEditRequestHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(getEditRequestBody({}))
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete attachment' }));
        throw new Error(errorData.error || 'Failed to delete attachment');
      }

      setAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
      showToast('Upload removed');
    } catch (error: any) {
      console.error('Error deleting attachment:', error);
      showToast(error.message || 'Failed to delete upload');
    }
  };

  const handleApplyProjectBackground = (text: string, mode: ProjectBackgroundApplyMode) => {
    const cleanText = text.trim();
    if (!cleanText) return;

    setProjectData((prev) => ({
      ...prev,
      background: mode === 'append' && prev.background.trim()
        ? `${prev.background.trim()}\n\n${cleanText}`
        : cleanText,
    }));

    showToast('Project overview draft applied');
  };

  const handleRenameProject = async (name: string) => {
    if (!sessionId || !isAdminVerified || !adminSessionId) return;

    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-session': adminSessionId,
        },
        body: JSON.stringify({
          name,
          project_client: name,
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to rename project' }));
        throw new Error(errorData.error || 'Failed to rename project');
      }

      setCurrentSession((prev) => prev ? { ...prev, name } : prev);
      setProjectData((prev) => ({ ...prev, client: name }));
      showToast('Project name updated');
    } catch (error: any) {
      console.error('Error renaming project:', error);
      showToast(error.message || 'Failed to rename project');
    }
  };

  const handleCardUpdate = async (cardId: string, updates: Partial<CardData>) => {
    if (!sessionId) return;

    setSavingCardIds((prev) => new Set(prev).add(cardId));
    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}/cards/${cardId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(isAdminVerified && adminSessionId ? { 'x-admin-session': adminSessionId } : {})
        },
        body: JSON.stringify(getEditRequestBody(updates))
      });

      if (!response.ok) {
        throw new Error('Failed to update card');
      }

      sendCardUpdate(cardId, updates);
      setLiveCardDrafts((prev) => {
        if (!prev[cardId]) return prev;
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
    } catch (error) {
      console.error('Error updating card:', error);
      throw error;
    } finally {
      setSavingCardIds((prev) => {
        if (!prev.has(cardId)) return prev;
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  };

  const handleCardAdd = async (cardData: Omit<CardData, 'id'>) => {
    if (!sessionId) return;

    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}/cards`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isAdminVerified && adminSessionId ? { 'x-admin-session': adminSessionId } : {})
        },
        body: JSON.stringify(getEditRequestBody(cardData))
      });

      if (!response.ok) {
        throw new Error('Failed to create card');
      }

      const data = await response.json();

      const newCard: CardData = {
        id: data.card.id,
        section: data.card.section,
        content: cardData.content || data.card.content || '',
        starred: data.card.starred || false,
        order: data.card.order_index
      };

      setCards(prev => [...prev, newCard]);
      sendCardDraft(newCard.id, newCard.content, true);
      sendCardCreate(newCard);

      return newCard.id;
    } catch (error) {
      console.error('Error creating card:', error);
      throw error;
    }
  };

  const createGeneratedCards = async (generatedCards: CardData[]) => {
    if (!sessionId) return;

    for (const card of generatedCards) {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}/cards`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isAdminVerified && adminSessionId ? { 'x-admin-session': adminSessionId } : {}),
        },
        body: JSON.stringify(getEditRequestBody({
          section: card.section,
          content: card.content,
          starred: card.starred
        }))
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save generated card' }));
        throw new Error(errorData.error || 'Failed to save generated card');
      }

      const data = await response.json();
      if (data.card?.id) {
        sendCardCreate({
          id: data.card.id,
          section: data.card.section,
          content: data.card.content || card.content || '',
          starred: data.card.starred || false,
          order: data.card.order_index,
        });
      }
    }

    const response = await fetch(apiUrl(`/api/sessions/${sessionId}`));
    if (response.ok) {
      const data = await response.json();
      mergeSessionCards(data.cards || []);
      setLiveCardDrafts({});
      setConnections(data.connections || []);
    }
  };

  const handleCardDelete = async (cardId: string) => {
    if (!sessionId) return;

    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}/cards/${cardId}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(isAdminVerified && adminSessionId ? { 'x-admin-session': adminSessionId } : {})
        },
        body: JSON.stringify(getEditRequestBody({}))
      });

      if (!response.ok) {
        throw new Error('Failed to delete card');
      }

      setCards(prev => prev.filter(card => card.id !== cardId));
      setConnections(prev => prev.filter(conn => conn.from !== cardId && conn.to !== cardId));
      sendCardDelete(cardId);
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  const handleCardReorder = async (section: string, cardIds: string[]) => {
    if (!sessionId) return;
    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}/cards/reorder`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isAdminVerified && adminSessionId ? { 'x-admin-session': adminSessionId } : {})
        },
        body: JSON.stringify(getEditRequestBody({ section, card_ids: cardIds }))
      });
      if (response.ok) {
        sendCardReorder(section, cardIds);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleConnectionCreate = async (from: string, to: string, threadId?: string, color?: string, ownerUserId?: string) => {
    if (!sessionId) return;
    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}/connections`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isAdminVerified && adminSessionId ? { 'x-admin-session': adminSessionId } : {})
        },
        body: JSON.stringify(getEditRequestBody({
          from,
          to,
          threadId,
          color: color || userProfile?.color || partyUserColor,
          ownerUserId,
        }))
      });
      if (response.ok) {
        const data = await response.json();
        setConnections(prev => prev.some((connection) => connection.id === data.connection.id)
          ? prev.map((connection) => connection.id === data.connection.id ? data.connection : connection)
          : [...prev, data.connection]);
        sendConnectionCreate(data.connection);
      }
    } catch (error) {
      console.error('Error creating connection', error);
    }
  };

  const handleConnectionDelete = async (connectionId: string) => {
    if (!sessionId) return;
    let removedConnection: ConnectionData | undefined;
    setConnections(prev => {
      removedConnection = prev.find(c => c.id === connectionId);
      return prev.filter(c => c.id !== connectionId);
    });

    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}/connections/${encodeURIComponent(connectionId)}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(isAdminVerified && adminSessionId ? { 'x-admin-session': adminSessionId } : {})
        },
        body: JSON.stringify(getEditRequestBody({}))
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete connection' }));
        throw new Error(errorData.error || 'Failed to delete connection');
      }

      sendConnectionDelete(connectionId);
    } catch (error) {
      if (removedConnection) {
        setConnections(prev => prev.some(c => c.id === removedConnection?.id) ? prev : [...prev, removedConnection!]);
      }
      console.error('Error deleting connection', error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium text-gray-700">Loading session...</span>
        </div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Session Not Found</h1>
          <p className="text-gray-600">The session you're looking for doesn't exist.</p>
          <a href="/" className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (showPasswordWall) {
    return (
      <SessionPasswordWall
        sessionId={currentSession.id}
        sessionName={currentSession.name}
        onVerify={verifyPassword}
      />
    );
  }

  const showBriefWorkspace = !currentSession.onboarding_completed || workspaceView === 'brief';
  const showCanvasWorkspace = currentSession.onboarding_completed && !showBriefWorkspace;
  const liveTimerAvailable = showCanvasWorkspace && isConnected;
  const canControlLiveTimer = liveTimerAvailable;

  return (
    <div className="flex h-screen w-full bg-gray-50 text-gray-900 font-sans overflow-hidden antialiased">
      {dialog}
      <UserProfilePrompt
        isOpen={showProfilePrompt}
        onSubmit={handleProfileSubmit}
        onClose={() => setShowProfilePrompt(false)}
      />

      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-red-500 text-white px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-2">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 opacity-80 hover:opacity-100">&times;</button>
        </div>
      )}

      <Sidebar
        onViewChange={() => {}}
        currentView={showBriefWorkspace ? "new" : "canvas"}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        sessions={adminSessions}
        currentSession={currentSession}
        isEditMode={isEditMode}
        onLogout={() => {}}
        isAdmin={isAdminVerified}
        onCreateSession={handleCreateAdminSession}
        onLoadSession={(nextSessionId) => navigate(`/${nextSessionId}`)}
        onDeleteSession={handleDeleteAdminSession}
        activeConnections={liveConnections}
        currentConnectionId={currentConnectionId || ''}
        onKickUser={connectionRole === 'admin' ? handleKickUser : undefined}
        presenceDebug={presenceDebug}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar
          projectName={currentSession.name}
          showTitle={false}
          showTimer={!showBriefWorkspace}
          onTutorialSelect={setActiveTutorial}
          sharedTimer={liveTimerAvailable ? timerState : undefined}
          canControlTimer={canControlLiveTimer}
          onTimerCommand={liveTimerAvailable ? sendTimerCommand : undefined}
          rightContent={
            <div className="flex items-center gap-2">
              {showCanvasWorkspace && (
                <button
                  onClick={() => setWorkspaceView('brief')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors shadow-sm whitespace-nowrap"
                >
                  Return to brief
                </button>
              )}
              {showBriefWorkspace && currentSession.onboarding_completed && (
                <button
                  onClick={() => setWorkspaceView('canvas')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors shadow-sm whitespace-nowrap"
                >
                  Return to canvas
                </button>
              )}
              {isAdminVerified && (
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors shadow-sm whitespace-nowrap"
                >
                  Exit Session
                </button>
              )}
            </div>
          }
        >
          <div className="flex items-center gap-3">
            <ActiveUsers users={activeUsers} currentUserId={userProfile?.id || ''} />
            <ConnectionStatus isConnected={isConnected} isConnecting={isConnecting} message={partyKitError?.message} />
            <button
              type="button"
              onClick={() => setIsRightPanelCompact((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-900"
              title={isRightPanelCompact ? 'Expand chat panel' : 'Collapse chat panel'}
              aria-label={isRightPanelCompact ? 'Expand chat panel' : 'Collapse chat panel'}
            >
              {isRightPanelCompact ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
            </button>
          </div>
        </TopBar>

        <div className="flex flex-1 overflow-hidden relative">
          {showCanvasWorkspace ? (
            <>
              <Canvas
                onSelectCard={setSelectedCard}
                selectedCard={selectedCard}
                cards={cards}
                setCards={setCards}
                projectData={projectData}
                showToast={showToast}
                selectedModel={selectedModel}
                generatingSections={generatingSections}
                isEditMode={isEditMode}
                currentSession={currentSession}
                onCardUpdate={handleCardUpdate}
                onCardDraft={sendCardDraft}
                onCardAdd={handleCardAdd}
                onCardDelete={handleCardDelete}
                onCardReorder={handleCardReorder}
                onConnectionCreate={handleConnectionCreate}
                onConnectionDelete={handleConnectionDelete}
                connections={connections}
                onCursorMove={sendCursorMove}
                activeUsers={activeUsers}
                liveCardDrafts={liveCardDrafts}
                savingCardIds={savingCardIds}
                currentUserId={userProfile?.id || ''}
                currentUserColor={userProfile?.color || partyUserColor}
                activeTutorial={activeTutorial}
                onCloseTutorial={() => setActiveTutorial(null)}
              />
              {!isRightPanelCompact && (
                <RightPanel
                  selectedCard={selectedCard}
                  currentView="canvas"
                  cards={cards}
                  projectData={projectData}
                  selectedModel={selectedModel}
                  currentSession={currentSession}
                  isEditMode={isEditMode}
                  attachments={attachments}
                  sessionNotes={sessionNotes}
                  currentUser={userProfile ? {
                    userId: userProfile.id,
                    name: userProfile.name,
                    role: isAdminVerified ? 'admin' : 'participant',
                  } : undefined}
                  onUpdateSessionNote={handleUpdateSessionNote}
                  onUpdateProjectBackground={handleUpdateProjectBackground}
                  onSaveAndRegenerateProjectBackground={isEditMode ? handleRegenerateCards : undefined}
                />
              )}
            </>
          ) : (
            <>
              {isAdminVerified || currentSession.onboarding_completed ? (
                <NewProject
                  projectName={currentSession.name}
                  sessionId={currentSession.id}
                  onRenameProject={handleRenameProject}
                  onStart={handleStartProject}
                  onSaveChanges={handleSaveProjectChanges}
                  onRegenerateCards={handleRegenerateCards}
                  projectData={projectData}
                  setProjectData={setProjectData}
                  isGenerating={isGenerating}
                  isSavingProjectChanges={isSavingProjectChanges}
                  isRegeneratingCards={isRegeneratingCards}
                  showGenerateCanvasButton={!currentSession.onboarding_completed}
                  showRegenerateCardsButton={isEditMode && currentSession.onboarding_completed}
                  attachments={attachments}
                  isUploadingAttachments={isUploadingAttachments}
                  isGeneratingBriefFromUploads={isGeneratingBriefFromUploads}
                  onUploadFiles={handleUploadFiles}
                  onUploadSessionArchive={handleUploadSessionArchive}
                  onGenerateBriefFromUploads={handleGenerateBriefFromUploads}
                  onUseAttachmentText={handleUseAttachmentText}
                  onRenameAttachment={handleRenameAttachment}
                  onUpdateAttachmentNote={handleUpdateAttachmentNote}
                  onDeleteAttachment={handleDeleteAttachment}
                  canManageProjectName={isAdminVerified}
                  canManageAttachments={isAdminVerified || isEditMode}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">&bull;&bull;&bull;</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Setup in Progress</h2>
                    <p className="text-gray-600 max-w-md mx-auto">
                      The facilitator is currently setting up this session. Please wait a moment and the canvas will appear automatically when it's ready.
                    </p>
                  </div>
                </div>
              )}
              {!isRightPanelCompact && (
                <RightPanel
                  selectedCard={selectedCard}
                  currentView="new"
                  cards={cards}
                  projectData={projectData}
                  selectedModel={selectedModel}
                  currentSession={currentSession}
                  isEditMode={isEditMode}
                  attachments={attachments}
                  onApplyProjectBackground={handleApplyProjectBackground}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
