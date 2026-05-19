/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiUrl } from '../config/api';
import { CardData, ConnectionData } from '../types';

interface Session {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  project_client?: string;
  project_background?: string;
  project_notes?: string;
}

interface SessionContextType {
  // Current session state
  currentSession: Session | null;
  cards: CardData[];
  connections: ConnectionData[];
  isLoading: boolean;
  isEditMode: boolean;
  
  // Admin state
  allSessions: Session[];
  
  // Actions
  loadSession: (sessionId: string) => Promise<void>;
  createSession: (name: string, projectData?: { client?: string; background?: string; notes?: string }) => Promise<string>;
  refreshSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  
  // Password
  verifyPassword: (password: string) => Promise<boolean>;
  
  // Card operations
  addCard: (section: string, content?: string) => Promise<void>;
  updateCard: (cardId: string, updates: Partial<CardData>) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  reorderCards: (section: string, cardIds: string[]) => Promise<void>;
  
  // Connection operations
  addConnection: (from: string, to: string) => Promise<void>;
  deleteConnection: (connectionId: string) => Promise<void>;
  saveConnections: (connections: ConnectionData[]) => Promise<void>;
  
  // Export
  exportSession: (format: 'zip' | 'markdown' | 'json') => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Load all sessions (admin view)
  const refreshSessions = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/sessions'));
      if (response.ok) {
        const data = await response.json();
        setAllSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }, []);

  // Load a specific session
  const loadSession = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}`));
      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data.session);
        
        // Transform cards to match CardData type
        const transformedCards: CardData[] = (data.cards || []).map((c: any) => ({
          id: c.id,
          section: c.section,
          content: c.content || '',
          starred: c.starred || false,
          notes: undefined
        }));
        
        setCards(transformedCards);
        setConnections(data.connections || []);
        
        // Check if we have password in sessionStorage
        const savedPassword = sessionStorage.getItem(`session_${sessionId}_password`);
        if (savedPassword) {
          // Verify it still works
          const verifyResponse = await fetch(apiUrl(`/api/sessions/${sessionId}/verify`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: savedPassword })
          });
          
          if (verifyResponse.ok) {
            const { valid } = await verifyResponse.json();
            setIsEditMode(valid);
          }
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new session
  const createSession = useCallback(async (
    name: string, 
    projectData?: { client?: string; background?: string; notes?: string }
  ): Promise<string> => {
    try {
      const response = await fetch(apiUrl('/api/sessions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          project_client: projectData?.client || '',
          project_background: projectData?.background || '',
          project_notes: projectData?.notes || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newSession = data.session;
        
        // Save password to sessionStorage automatically for creator
        sessionStorage.setItem(`session_${newSession.id}_password`, newSession.password);
        
        // Refresh the list
        await refreshSessions();
        
        return newSession.id;
      }
      throw new Error('Failed to create session');
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }, [refreshSessions]);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/sessions/${sessionId}`), {
        method: 'DELETE'
      });

      if (response.ok) {
        await refreshSessions();
        
        // If we're currently viewing this session, clear it
        if (currentSession?.id === sessionId) {
          setCurrentSession(null);
          setCards([]);
          setConnections([]);
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }, [currentSession?.id, refreshSessions]);

  // Verify password
  const verifyPassword = useCallback(async (password: string): Promise<boolean> => {
    if (!currentSession) return false;
    
    try {
      const response = await fetch(apiUrl(`/api/sessions/${currentSession.id}/verify`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        const { valid } = await response.json();
        if (valid) {
          setIsEditMode(true);
          sessionStorage.setItem(`session_${currentSession.id}_password`, password);
        }
        return valid;
      }
      return false;
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }, [currentSession]);

  // Add a card
  const addCard = useCallback(async (section: string, content?: string) => {
    if (!currentSession || !isEditMode) return;
    
    try {
      const response = await fetch(apiUrl(`/api/sessions/${currentSession.id}/cards`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          content: content || '',
          starred: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newCard: CardData = {
          id: data.card.id,
          section: data.card.section,
          content: data.card.content || '',
          starred: data.card.starred || false
        };
        setCards(prev => [...prev, newCard]);
      }
    } catch (error) {
      console.error('Error adding card:', error);
    }
  }, [currentSession, isEditMode]);

  // Update a card
  const updateCard = useCallback(async (cardId: string, updates: Partial<CardData>) => {
    if (!currentSession || !isEditMode) return;
    
    try {
      const response = await fetch(apiUrl(`/api/sessions/${currentSession.id}/cards/${cardId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        setCards(prev => prev.map(c => 
          c.id === cardId ? { ...c, ...updates } : c
        ));
      }
    } catch (error) {
      console.error('Error updating card:', error);
    }
  }, [currentSession, isEditMode]);

  // Delete a card
  const deleteCard = useCallback(async (cardId: string) => {
    if (!currentSession || !isEditMode) return;
    
    try {
      const response = await fetch(apiUrl(`/api/sessions/${currentSession.id}/cards/${cardId}`), {
        method: 'DELETE'
      });

      if (response.ok) {
        setCards(prev => prev.filter(c => c.id !== cardId));
        // Also remove connections involving this card
        setConnections(prev => prev.filter(c => c.from !== cardId && c.to !== cardId));
      }
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  }, [currentSession, isEditMode]);

  // Reorder cards
  const reorderCards = useCallback(async (section: string, cardIds: string[]) => {
    if (!currentSession || !isEditMode) return;
    
    try {
      const response = await fetch(apiUrl(`/api/sessions/${currentSession.id}/cards/reorder`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, card_ids: cardIds })
      });

      if (response.ok) {
        // Update local state to reflect new order
        setCards(prev => {
          const reordered: CardData[] = [];
          const sectionCards = prev.filter(c => c.section === section);
          const otherCards = prev.filter(c => c.section !== section);
          
          for (const id of cardIds) {
            const card = sectionCards.find(c => c.id === id);
            if (card) reordered.push(card);
          }
          
          return [...otherCards, ...reordered];
        });
      }
    } catch (error) {
      console.error('Error reordering cards:', error);
    }
  }, [currentSession, isEditMode]);

  // Add connection
  const addConnection = useCallback(async (from: string, to: string) => {
    if (!currentSession || !isEditMode) return;
    
    try {
      const response = await fetch(apiUrl(`/api/sessions/${currentSession.id}/connections`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to })
      });

      if (response.ok) {
        const data = await response.json();
        setConnections(prev => [...prev, data.connection]);
      }
    } catch (error) {
      console.error('Error adding connection:', error);
    }
  }, [currentSession, isEditMode]);

  // Delete connection
  const deleteConnection = useCallback(async (connectionId: string) => {
    if (!currentSession || !isEditMode) return;
    
    try {
      const response = await fetch(apiUrl(`/api/sessions/${currentSession.id}/connections/${connectionId}`), {
        method: 'DELETE'
      });

      if (response.ok) {
        setConnections(prev => prev.filter(c => c.id !== connectionId));
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
    }
  }, [currentSession, isEditMode]);

  // Save all connections (bulk update)
  const saveConnections = useCallback(async (newConnections: ConnectionData[]) => {
    if (!currentSession || !isEditMode) return;
    
    try {
      const response = await fetch(apiUrl(`/api/sessions/${currentSession.id}/connections/bulk`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connections: newConnections })
      });

      if (response.ok) {
        setConnections(newConnections);
      }
    } catch (error) {
      console.error('Error saving connections:', error);
    }
  }, [currentSession, isEditMode]);

  // Export session
  const exportSession = useCallback((format: 'zip' | 'markdown' | 'json') => {
    if (!currentSession) return;
    
    const endpoints = {
      zip: apiUrl(`/api/sessions/${currentSession.id}/export/zip`),
      markdown: apiUrl(`/api/sessions/${currentSession.id}/export/markdown`),
      json: apiUrl(`/api/sessions/${currentSession.id}/export/json`)
    };
    
    const extensions = {
      zip: 'zip',
      markdown: 'md',
      json: 'json'
    };
    
    // Create a temporary link and click it
    const link = document.createElement('a');
    link.href = endpoints[format];
    link.download = `${currentSession.id}.${extensions[format]}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentSession]);

  // Load sessions on mount
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const value: SessionContextType = {
    currentSession,
    cards,
    connections,
    isLoading,
    isEditMode,
    allSessions,
    loadSession,
    createSession,
    refreshSessions,
    deleteSession,
    verifyPassword,
    addCard,
    updateCard,
    deleteCard,
    reorderCards,
    addConnection,
    deleteConnection,
    saveConnections,
    exportSession
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
