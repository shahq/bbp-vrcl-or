import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Star, Plus, Download, Sparkles, Loader2, Trash2, FileText } from 'lucide-react';
import { COLUMNS } from '../data';
import { CardData, ConnectionData, Section } from '../types';
import { apiUrl } from '../config/api';
import { motion } from 'motion/react';
import InfiniteCanvas from './InfiniteCanvas';
import { UserCursors } from './UserPresence';
import FloatingVideoPlayer from './FloatingVideoPlayer';
import type { UserPresence } from '../../party/index';
import { generateSingleIdea, ModelType } from '../services/ai';
import type { TutorialItem } from '../tutorials';

interface CanvasProps {
  onSelectCard: (id: string | null) => void;
  selectedCard: string | null;
  cards: CardData[];
  setCards: React.Dispatch<React.SetStateAction<CardData[]>>;
  projectData: { client: string; background: string; notes: string };
  showToast: (msg: string) => void;
  selectedModel: ModelType;
  isEditMode?: boolean;
  currentSession?: { id: string; name: string } | null;
  onEditRequest?: () => void;
  onCardUpdate?: (cardId: string, updates: Partial<CardData>) => Promise<void>;
  onCardAdd?: (card: Omit<CardData, 'id'>) => Promise<string | undefined>;
  onCursorMove?: (x: number, y: number) => void;
  connections?: ConnectionData[];
  onCardDelete?: (cardId: string) => Promise<void>;
  onCardReorder?: (section: string, cardIds: string[]) => Promise<void>;
  onConnectionCreate?: (from: string, to: string, threadId?: string, color?: string, ownerUserId?: string) => Promise<void>;
  onConnectionDelete?: (connectionId: string) => Promise<void>;
  activeUsers?: UserPresence[];
  currentUserId?: string;
  currentUserColor?: string;
  activeTutorial?: TutorialItem | null;
  onCloseTutorial?: () => void;
}

interface ConnectionLineProps {
  connectionId?: string;
  startId: string;
  endId: string;
  isDrawing?: boolean;
  refreshKey?: string;
  color?: string;
  isSelected?: boolean;
  onSelect?: (connectionId: string) => void;
  interactive?: boolean;
}

const COLUMN_ORDER: Section[] = ['place', 'role', 'challenge', 'point_a', 'point_b', 'change', 'story'];

function getColumnIndex(section: Section | undefined) {
  return section ? COLUMN_ORDER.indexOf(section) : -1;
}

function isStorySection(section: Section | undefined) {
  return section === 'story';
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
  connectionId,
  startId,
  endId,
  isDrawing = false,
  refreshKey,
  color = '#6366f1',
  isSelected = false,
  onSelect,
  interactive = false,
}) => {
  const [path, setPath] = useState('');

  useEffect(() => {
    let rafId: number;
    let ro: ResizeObserver | null = null;

    const updatePath = () => {
      const startEl = document.getElementById(startId);
      const endEl = document.getElementById(endId);
      const containerEl = document.getElementById('board-container');

      if (startEl && endEl && containerEl) {
        const startRect = startEl.getBoundingClientRect();
        const endRect = endEl.getBoundingClientRect();
        const containerRect = containerEl.getBoundingClientRect();

        const scale = containerEl.offsetWidth > 0 ? containerRect.width / containerEl.offsetWidth : 1;

        const startX = (startRect.left - containerRect.left + startRect.width / 2) / scale;
        const startY = (startRect.top - containerRect.top + startRect.height / 2) / scale;
        const endX = (endRect.left - containerRect.left + endRect.width / 2) / scale;
        const endY = (endRect.top - containerRect.top + endRect.height / 2) / scale;

        const pathStartX = startX;
        const pathEndX = endX;
        const dx = Math.max(Math.abs(pathEndX - pathStartX) * 0.5, 50);
        setPath(`M ${pathStartX} ${startY} C ${pathStartX + dx} ${startY}, ${pathEndX - dx} ${endY}, ${pathEndX} ${endY}`);
      } else {
        setPath('');
      }
      rafId = requestAnimationFrame(updatePath);
    };

    // Kick off continuous re-measurement loop (handles pan, animations, etc.)
    rafId = requestAnimationFrame(updatePath);

    // Also observe size changes on the involved elements for instant updates
    ro = new ResizeObserver(() => {
      // Loop will pick up the change on next frame
    });
    const startEl = document.getElementById(startId);
    const endEl = document.getElementById(endId);
    const containerEl = document.getElementById('board-container');
    if (startEl) ro.observe(startEl);
    if (endEl) ro.observe(endEl);
    if (containerEl) ro.observe(containerEl);

    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
    };
  }, [startId, endId, refreshKey]);

  if (!path) return null;

  return (
    <svg
      className={`absolute inset-0 pointer-events-none ${interactive ? 'z-20' : 'z-0'}`}
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      {connectionId && (
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={18}
          strokeLinecap="round"
          className="cursor-pointer"
          style={{ pointerEvents: 'stroke' }}
          onClick={(event) => {
            event.stopPropagation();
              onSelect?.(connectionId);
          }}
        />
      )}
      <path 
        d={path} 
        fill="none" 
        stroke={color} 
        strokeWidth={isSelected ? 5 : 3} 
        strokeLinecap="round" 
        strokeDasharray={isDrawing ? "5,5" : "none"}
        className={connectionId ? 'cursor-pointer' : undefined}
        style={{
          filter: isSelected ? `drop-shadow(0 0 4px ${color})` : undefined,
          pointerEvents: connectionId ? 'stroke' : 'none',
        }}
        onClick={(event) => {
          if (!connectionId) return;
          event.stopPropagation();
              onSelect?.(connectionId);
        }}
      />
    </svg>
  );
}

export default function Canvas({ onSelectCard, selectedCard, cards, setCards, projectData, showToast, selectedModel, isEditMode, currentSession, onEditRequest, onCardUpdate, onCardAdd, onCursorMove, connections = [], onCardDelete, onCardReorder, onConnectionCreate, onConnectionDelete, activeUsers = [], currentUserId = '', currentUserColor = '#6366f1', activeTutorial, onCloseTutorial }: CanvasProps) {
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const [drawingLine, setDrawingLine] = useState<{ startNodeId: string, endX: number, endY: number, startX: number, startY: number } | null>(null);

  const [generatingCards, setGeneratingCards] = useState<Record<string, boolean>>({});
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [showOtherUsersConnections, setShowOtherUsersConnections] = useState(true);

  
  // Track which card is being edited inline
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // InfiniteCanvas pan/scale state - lifted here to persist across card edits
  const [pan, setPan] = useState({ x: 100, y: 100 });
  const [scale, setScale] = useState(1);
  const panRef = useRef(pan);
  const scaleRef = useRef(scale);
  const cursorFrameRef = useRef<number | null>(null);
  const latestCursorPositionRef = useRef<{ clientX: number; clientY: number } | null>(null);

  const getSourceCardId = useCallback((startNodeId: string): string | null => {
    if (startNodeId.startsWith('node-right-')) {
      return startNodeId.replace('node-right-', '');
    }
    if (startNodeId.startsWith('card-body-')) {
      return startNodeId.replace('card-body-', '');
    }
    return null;
  }, []);

  const getCardSection = useCallback((cardId: string) => (
    cards.find((card) => card.id === cardId)?.section
  ), [cards]);

  const isCurrentUserConnection = useCallback((connection: ConnectionData) => {
    if (currentUserId && connection.ownerUserId) {
      return connection.ownerUserId === currentUserId;
    }
    if (currentUserColor && connection.color) {
      return connection.color === currentUserColor;
    }
    return false;
  }, [currentUserColor, currentUserId]);

  const getCurrentUserConnections = useCallback(() => (
    connections.filter(isCurrentUserConnection)
  ), [connections, isCurrentUserConnection]);

  const getCurrentUserThreadId = useCallback(() => {
    return getCurrentUserConnections().find((connection) => connection.threadId)?.threadId
      || (currentUserId ? `thread-${currentUserId}` : `thread-${currentUserColor.replace(/[^a-zA-Z0-9_-]/g, '')}`);
  }, [currentUserColor, currentUserId, getCurrentUserConnections]);

  const getDownstreamConnectionIds = useCallback((startCardId: string, sourceConnections = getCurrentUserConnections()) => {
    const ids = new Set<string>();
    const visitedCards = new Set<string>();

    const walk = (cardId: string) => {
      if (visitedCards.has(cardId)) return;
      visitedCards.add(cardId);

      sourceConnections
        .filter((connection) => connection.from === cardId)
        .forEach((connection) => {
          ids.add(connection.id);
          walk(connection.to);
        });
    };

    walk(startCardId);
    return Array.from(ids);
  }, [getCurrentUserConnections]);

  const getConnectionBreakCleanupIds = useCallback((connection: ConnectionData) => {
    return [connection.id, ...getDownstreamConnectionIds(connection.to)];
  }, [getDownstreamConnectionIds]);

  const getCardDeleteCleanupConnectionIds = useCallback((cardId: string) => {
    const ids = new Set<string>();

    connections
      .filter((connection) => connection.from === cardId || connection.to === cardId)
      .forEach((connection) => ids.add(connection.id));

    getDownstreamConnectionIds(cardId).forEach((connectionId) => ids.add(connectionId));

    return Array.from(ids);
  }, [connections, getDownstreamConnectionIds]);

  const deleteConnections = useCallback(async (connectionIds: string[]) => {
    const uniqueConnectionIds = Array.from(new Set(connectionIds));
    if (uniqueConnectionIds.length === 0) return;

    try {
      await Promise.all(uniqueConnectionIds.map((connectionId) => onConnectionDelete?.(connectionId)));
      setSelectedConnectionId((current) => (
        current && uniqueConnectionIds.includes(current) ? null : current
      ));
    } catch (error) {
      console.error('Error deleting connection:', error);
      showToast('Failed to delete connection');
    }
  }, [onConnectionDelete, showToast]);

  const ownedThreadConnections = getCurrentUserConnections();
  const connectedCardIdsBySection = ownedThreadConnections.reduce((sections, connection) => {
    [connection.from, connection.to].forEach((cardId) => {
      const section = getCardSection(cardId);
      if (!section) return;
      if (!sections.has(section)) sections.set(section, new Set<string>());
      sections.get(section)!.add(cardId);
    });
    return sections;
  }, new Map<string, Set<string>>());

  const canStartConnectionFromCard = useCallback((cardId: string) => {
    const section = getCardSection(cardId);
    if (!section || isStorySection(section)) return true;
    const connectedCardIds = connectedCardIdsBySection.get(section);
    return !connectedCardIds || connectedCardIds.has(cardId);
  }, [connectedCardIdsBySection, getCardSection]);

  const isCardDimmedByThread = useCallback((cardId: string) => {
    const section = getCardSection(cardId);
    if (!section || isStorySection(section)) return false;
    const connectedCardIds = connectedCardIdsBySection.get(section);
    return Boolean(connectedCardIds && !connectedCardIds.has(cardId));
  }, [connectedCardIdsBySection, getCardSection]);

  const getConnectionThreadMeta = useCallback((fromCardId: string, toCardId: string) => {
    return {
      threadId: getCurrentUserThreadId(),
      color: currentUserColor,
      ownerUserId: currentUserId,
    };
  }, [currentUserColor, currentUserId, getCurrentUserThreadId]);

  const createThreadedConnection = useCallback(async (fromCardId: string, toCardId: string) => {
    if (getCurrentUserConnections().some((connection) => connection.from === fromCardId && connection.to === toCardId)) return;
    const { threadId, color, ownerUserId } = getConnectionThreadMeta(fromCardId, toCardId);
    const sourceSection = getCardSection(fromCardId);
    const targetSection = getCardSection(toCardId);

    if (getColumnIndex(targetSection) <= getColumnIndex(sourceSection)) {
      showToast('Connect cards from left to right across the story columns');
      return;
    }

    const cleanupIds = new Set<string>();
    const currentUserConnections = getCurrentUserConnections();

    currentUserConnections
      .filter((connection) => connection.from === fromCardId || connection.to === toCardId)
      .forEach((connection) => getConnectionBreakCleanupIds(connection).forEach((id) => cleanupIds.add(id)));

    if (targetSection) {
      currentUserConnections
        .filter((connection) => {
          const fromSection = getCardSection(connection.from);
          const toSection = getCardSection(connection.to);
          return (
            (fromSection === targetSection && connection.from !== toCardId)
            || (toSection === targetSection && connection.to !== toCardId)
          );
        })
        .forEach((connection) => getConnectionBreakCleanupIds(connection).forEach((id) => cleanupIds.add(id)));
    }

    if (cleanupIds.size > 0) {
      await deleteConnections(Array.from(cleanupIds));
    }

    onConnectionCreate?.(fromCardId, toCardId, threadId, color, ownerUserId);
  }, [connections, deleteConnections, getCardSection, getConnectionBreakCleanupIds, getConnectionThreadMeta, getCurrentUserConnections, onConnectionCreate, showToast]);

  const handlePanChange = useCallback((nextPan: { x: number; y: number }) => {
    panRef.current = nextPan;
    setPan(nextPan);
  }, []);

  const handleScaleChange = useCallback((nextScale: number) => {
    scaleRef.current = nextScale;
    setScale(nextScale);
  }, []);

  const handleViewportChange = useCallback((nextPan: { x: number; y: number }, nextScale: number) => {
    panRef.current = nextPan;
    scaleRef.current = nextScale;
  }, []);

  useEffect(() => {
    return () => {
      if (cursorFrameRef.current !== null) {
        cancelAnimationFrame(cursorFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (drawingLine) {
        setDrawingLine(prev => prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null);
      }
    };

    const findTargetCardId = (el: Element | null): string | null => {
      // Traverse up to find a node-left or data-card-id
      let current: Element | null = el;
      while (current) {
        if (current.id && current.id.startsWith('node-left-')) {
          return current.id.replace('node-left-', '');
        }
        const cardId = current.getAttribute('data-card-id');
        if (cardId) {
          return cardId;
        }
        current = current.parentElement;
      }
      return null;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (drawingLine) {
        const dummy = document.getElementById('cursor-dummy');
        if (dummy) dummy.style.display = 'none';

        const el = document.elementFromPoint(e.clientX, e.clientY);

        if (dummy) dummy.style.display = 'block';

        const fromCardId = getSourceCardId(drawingLine.startNodeId);
        const toCardId = findTargetCardId(el);

        if (fromCardId && toCardId && fromCardId !== toCardId) {
          createThreadedConnection(fromCardId, toCardId);
          setDrawingLine(null);
          return;
        }

        const dist = Math.hypot(e.clientX - drawingLine.startX, e.clientY - drawingLine.startY);
        if (dist < 10 && el && el.id === drawingLine.startNodeId) {
          setDrawingLine(null);
          return;
        }

        setDrawingLine(null);
      }
    };

    if (drawingLine) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [connections, createThreadedConnection, drawingLine, getSourceCardId]);

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    if (!isEditMode) return;
    setDraggedCardId(cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverCard = (e: React.DragEvent, targetCardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedCardId && draggedCardId !== targetCardId && isEditMode) {
      setDragOverCardId(targetCardId);
      setDragOverColId(null);
    }
  };

  const handleDropOnCard = (e: React.DragEvent, targetCardId: string, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCardId(null);
    setDragOverColId(null);
    if (!draggedCardId || draggedCardId === targetCardId || !isEditMode) return;

    const newCards = [...cards];
    const sourceIndex = newCards.findIndex(c => c.id === draggedCardId);
    const targetIndex = newCards.findIndex(c => c.id === targetCardId);
    
    if (sourceIndex > -1 && targetIndex > -1) {
      const [movedCard] = newCards.splice(sourceIndex, 1);
      const sectionChanged = movedCard.section !== colId;
      movedCard.section = colId as any;
      newCards.splice(targetIndex, 0, movedCard);
      setCards(newCards);

      if (sectionChanged && onCardUpdate) {
        onCardUpdate(movedCard.id, { section: colId as any });
      }
      if (onCardReorder) {
        const sectionCards = newCards.filter(c => c.section === colId);
        onCardReorder(colId, sectionCards.map(c => c.id));
      }
    }
    setDraggedCardId(null);
  };

  const handleDragOverCol = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (draggedCardId && isEditMode) {
      setDragOverColId(colId);
      setDragOverCardId(null);
    }
  };

  const handleDropOnCol = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverColId(null);
    setDragOverCardId(null);
    if (!draggedCardId || !isEditMode) return;

    const newCards = [...cards];
    const sourceIndex = newCards.findIndex(c => c.id === draggedCardId);
    
    if (sourceIndex > -1) {
      const [movedCard] = newCards.splice(sourceIndex, 1);
      const sectionChanged = movedCard.section !== colId;
      movedCard.section = colId as any;
      newCards.push(movedCard);
      setCards(newCards);

      if (sectionChanged && onCardUpdate) {
        onCardUpdate(movedCard.id, { section: colId as any });
      }
      if (onCardReorder) {
        const sectionCards = newCards.filter(c => c.section === colId);
        onCardReorder(colId, sectionCards.map(c => c.id));
      }
    }
    setDraggedCardId(null);
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDragOverCardId(null);
    setDragOverColId(null);
  };

  const handleAddCard = async (colId: string) => {
    if (!isEditMode) {
      showToast('Enter password to add cards');
      return;
    }
    
    // Get the next index for this section
    const sectionCards = cards.filter(c => c.section === colId);
    const nextIndex = sectionCards.length;
    
    const newCardData = {
      section: colId as any,
      content: '',
      starred: false,
      order: nextIndex
    };
    
    // Call API to create card if callback provided
    if (onCardAdd) {
      try {
        const cardId = await onCardAdd(newCardData);
        if (cardId) {
          setEditingCardId(cardId);
          setEditContent('');
        }
      } catch (error) {
        console.error('Error creating card:', error);
        showToast('Failed to create card');
      }
    } else {
      // Fallback to local state only
      const newCard: CardData = {
        id: `card-${Date.now()}`,
        ...newCardData
      };
      setCards([...cards, newCard]);
      setEditingCardId(newCard.id);
      setEditContent('');
    }
  };

  const handleUpdateCard = (cardId: string, content: string) => {
    if (!isEditMode) return;
    
    // Prevent infinite loop by returning early if content hasn't changed
    const card = cards.find(c => c.id === cardId);
    if (!card || card.content === content) return;

    setCards(cards.map(c => c.id === cardId ? { ...c, content } : c));
    if (onCardUpdate) {
      onCardUpdate(cardId, { content }).catch((error) => {
        console.error('Error updating card:', error);
        showToast('Failed to save changes');
      });
    }
  };

  const handleDoubleClick = (card: CardData) => {
    if (!isEditMode) {
      showToast('Enter password to edit cards');
      return;
    }
    
    setEditingCardId(card.id);
    setEditContent(card.content);
  };

  const handleSaveEdit = async (cardId: string) => {
    if (!isEditMode) return;
    
    // Update local state
    setCards(cards.map(c => c.id === cardId ? { ...c, content: editContent } : c));
    
    // Call API to persist if callback provided
    if (onCardUpdate) {
      try {
        await onCardUpdate(cardId, { content: editContent });
      } catch (error) {
        console.error('Error updating card:', error);
        showToast('Failed to save changes');
      }
    }
    
    setEditingCardId(null);
    setEditContent('');
  };

  const handleCancelEdit = () => {
    setEditingCardId(null);
    setEditContent('');
  };

  // Click outside any editing card to cancel edit mode
  useEffect(() => {
    if (!editingCardId) return;

    const handleClickOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const editingCard = document.getElementById(`card-${editingCardId}`);
      if (editingCard && !editingCard.contains(target)) {
        handleCancelEdit();
      }
    };

    // Use capture phase so this fires before InfiniteCanvas can capture the pointer
    document.addEventListener('pointerdown', handleClickOutside, { capture: true });

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, { capture: true });
    };
  }, [editingCardId]);

  // Auto-resize any active editing textarea to match its content height
  useEffect(() => {
    if (!editingCardId) return;
    const editingCard = document.getElementById(`card-${editingCardId}`);
    const textarea = editingCard?.querySelector('textarea') as HTMLTextAreaElement | undefined;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [editContent, editingCardId]);

  const handleGenerateSingle = async (cardId: string, colId: string) => {
    if (!isEditMode) return;
    
    setGeneratingCards(prev => ({ ...prev, [cardId]: true }));
    try {
      const idea = await generateSingleIdea(projectData.client, projectData.background, projectData.notes, colId, selectedModel);
      setEditContent(idea);
      setCards(prev => prev.map(card => card.id === cardId ? { ...card, content: idea } : card));
      setEditingCardId(null);

      if (onCardUpdate) {
        onCardUpdate(cardId, { content: idea }).catch((error) => {
          console.error('Error updating card:', error);
          showToast('Generated idea, but failed to save it');
        });
      }
    } catch (e: any) {
      console.error(e);
      if (e?.message?.includes('429') || e?.message?.includes('quota') || e?.status === 429) {
        showToast("AI quota exceeded. Please type your idea manually.");
      } else {
        showToast("Failed to generate idea. Please try again or type manually.");
      }
    } finally {
      setGeneratingCards(prev => ({ ...prev, [cardId]: false }));
    }
  };

  const handleAssembleStory = () => {
    if (!isEditMode) {
      showToast('Enter password to assemble stories');
      return;
    }

    const myConnections = getCurrentUserConnections();
    if (myConnections.length === 0) {
      showToast('Connect cards in your thread before assembling your story.');
      return;
    }

    const buildStoriesForConnections = (ownerConnections: ConnectionData[]) => {
      const nextMap = new Map<string, string[]>();
      const incomingCount = new Map<string, number>();
      const connectedCardIds = new Set<string>();

      for (const conn of ownerConnections) {
        if (!nextMap.has(conn.from)) nextMap.set(conn.from, []);
        nextMap.get(conn.from)!.push(conn.to);
        incomingCount.set(conn.to, (incomingCount.get(conn.to) || 0) + 1);
        connectedCardIds.add(conn.from);
        connectedCardIds.add(conn.to);
      }

      const roots: string[] = [];
      for (const cardId of connectedCardIds) {
        if ((incomingCount.get(cardId) || 0) === 0) {
          roots.push(cardId);
        }
      }

      if (roots.length === 0 && connectedCardIds.size > 0) {
        const sorted = Array.from(connectedCardIds).sort((a, b) => {
          const cardA = cards.find(c => c.id === a);
          const cardB = cards.find(c => c.id === b);
          return getColumnIndex(cardA?.section) - getColumnIndex(cardB?.section);
        });
        roots.push(sorted[0]);
      }

      const stories: Array<{ story: string; lastNodeId: string; sourceConnection: ConnectionData }> = [];

      function visit(cardId: string, visited: Set<string>, collectedIds: string[]) {
        if (visited.has(cardId)) return;
        visited.add(cardId);
        collectedIds.push(cardId);
        const nextIds = [...(nextMap.get(cardId) || [])].sort((a, b) => {
          const cardA = cards.find(c => c.id === a);
          const cardB = cards.find(c => c.id === b);
          return getColumnIndex(cardA?.section) - getColumnIndex(cardB?.section);
        });
        nextIds.forEach((nextId) => visit(nextId, visited, collectedIds));
      }

      for (const root of roots) {
        const visited = new Set<string>();
        const collectedIds: string[] = [];
        visit(root, visited, collectedIds);

        collectedIds.sort((a, b) => {
          const cardA = cards.find(c => c.id === a);
          const cardB = cards.find(c => c.id === b);
          return getColumnIndex(cardA?.section) - getColumnIndex(cardB?.section);
        });

        const sourceIds = collectedIds.filter((id) => cards.find(c => c.id === id)?.section !== 'story');
        const story = sourceIds
          .map(id => cards.find(c => c.id === id)?.content)
          .filter(Boolean)
          .join('\n\n');

        if (!story.trim()) return;

        const lastNodeId = sourceIds[sourceIds.length - 1] || collectedIds[collectedIds.length - 1];
        const sourceConnection = ownerConnections.find((connection) => connection.from === lastNodeId)
          || ownerConnections.find((connection) => connection.to === lastNodeId)
          || ownerConnections[ownerConnections.length - 1];

        stories.push({ story, lastNodeId, sourceConnection });
      }

      return stories;
    };

    const threadStories = buildStoriesForConnections(myConnections);

    if (threadStories.length === 0) {
      showToast('No content to assemble. Connect cards with content first.');
      return;
    }

    if (onCardAdd) {
      threadStories.forEach(({ story, lastNodeId, sourceConnection }, index) => {
        onCardAdd({ section: 'story', content: story, starred: false, order: index })
          .then((generatedCardId) => {
            if (generatedCardId && onConnectionCreate) {
              onConnectionCreate(
                lastNodeId,
                generatedCardId,
                sourceConnection?.threadId,
                sourceConnection?.color,
                sourceConnection?.ownerUserId
              );
            }
          })
          .catch((error) => {
            console.error('Error assembling story:', error);
            showToast('Failed to create story card');
          });
      });
    } else {
      const newCards = threadStories.map(({ story }, index) => ({
        id: `gen-story-${Date.now()}-${index}`,
        section: 'story' as const,
        content: story,
        starred: false,
      }));
      setCards([...cards, ...newCards]);
    }
  };

  // Handle mouse move for cursor tracking
  const handleMouseMove = (e: React.MouseEvent) => {
    if (onCursorMove) {
      latestCursorPositionRef.current = { clientX: e.clientX, clientY: e.clientY };

      if (cursorFrameRef.current !== null) {
        return;
      }

      cursorFrameRef.current = requestAnimationFrame(() => {
        const latestPosition = latestCursorPositionRef.current;
        cursorFrameRef.current = null;

        if (!latestPosition) return;

        const container = document.getElementById('canvas-container');
        if (container) {
          const rect = container.getBoundingClientRect();
          const x = (latestPosition.clientX - rect.left - panRef.current.x) / scaleRef.current;
          const y = (latestPosition.clientY - rect.top - panRef.current.y) / scaleRef.current;
          onCursorMove(x, y);
        }
      });
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-card-id]') ||
      target.closest('[id^="node-"]') ||
      target.closest('button') ||
      target.closest('textarea') ||
      target.closest('input')
    ) {
      return;
    }

    onSelectCard(null);
    setSelectedConnectionId(null);
  };

  useEffect(() => {
    if (!selectedConnectionId || !isEditMode) return;

    const handleKeyDown = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('textarea, input, [contenteditable="true"]')) return;
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId);
      deleteConnections(selectedConnection ? getConnectionBreakCleanupIds(selectedConnection) : [selectedConnectionId]);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [connections, deleteConnections, getConnectionBreakCleanupIds, isEditMode, selectedConnectionId]);

  // Handle delete card with confirmation
  const handleDeleteCard = useCallback(async (cardId: string) => {
    if (!isEditMode) {
      showToast('Enter password to delete cards');
      return;
    }
    
    const confirmed = window.confirm('Are you sure you want to delete this card?');
    if (!confirmed) return;
    
    try {
      await deleteConnections(getCardDeleteCleanupConnectionIds(cardId));
      if (onCardDelete) {
        await onCardDelete(cardId);
      }
    } catch (error) {
      console.error('Error deleting card:', error);
      showToast('Failed to delete card');
    }
  }, [deleteConnections, getCardDeleteCleanupConnectionIds, isEditMode, onCardDelete, showToast]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedConnectionId) return;
      if (e.key === 'Delete' && selectedCard && isEditMode) {
        const activeEl = document.activeElement;
        const isEditingText = activeEl?.tagName === 'TEXTAREA' || activeEl?.tagName === 'INPUT';
        if (!isEditingText) {
          handleDeleteCard(selectedCard);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCard, selectedConnectionId, isEditMode, handleDeleteCard]);

  const connectionRefreshKey = cards
    .map(card => `${card.id}:${card.section}:${card.order ?? ''}:${card.content?.length ?? 0}`)
    .join('|');

  return (
    <div id="canvas-container" className="h-full w-full relative bg-[#f5f5f5]" onMouseMove={handleMouseMove} onClick={handleCanvasClick}>
      <InfiniteCanvas
        pan={pan}
        scale={scale}
        onPanChange={handlePanChange}
        onScaleChange={handleScaleChange}
        onViewportChange={handleViewportChange}
      >
        <motion.div 
          id="board-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[32px] shadow-sm border border-gray-200 p-12 inline-block min-w-max relative"
          data-pan-target="true"
        >
          <UserCursors users={activeUsers} currentUserId={currentUserId} />
          {/* Render established connections */}
          {connections
            .filter((conn) => showOtherUsersConnections || isCurrentUserConnection(conn))
            .map(conn => {
              const isOwnConnection = isCurrentUserConnection(conn);
              return (
            <ConnectionLine
              key={conn.id}
              startId={`node-right-${conn.from}`}
              endId={`node-left-${conn.to}`}
              connectionId={conn.id}
              color={conn.color || '#6366f1'}
              isSelected={isOwnConnection && selectedConnectionId === conn.id}
              onSelect={isOwnConnection ? setSelectedConnectionId : undefined}
              interactive={isEditMode && isOwnConnection}
              refreshKey={`${connectionRefreshKey}:${editingCardId ?? ''}`}
            />
              );
            })}
          
          {/* Render currently drawn line */}
          {drawingLine && (
            <ConnectionLine
              startId={drawingLine.startNodeId}
              endId="cursor-dummy"
              isDrawing={true}
              refreshKey={`${drawingLine.endX}:${drawingLine.endY}`}
            />
          )}

          <div className="mb-16 relative z-10" data-pan-target="true">
            <h2 className="text-4xl font-bold mb-3 tracking-tight pointer-events-none">Act I</h2>
            <p className="text-2xl text-gray-800 font-medium pointer-events-none">Set up the story from the audience's viewpoint</p>
          </div>

          <div className="flex gap-8 items-start relative z-10" data-pan-target="true">
            {COLUMNS.map((col, colIdx) => {
              // Get cards for this column and sort by order
              const columnCards = cards
                .filter(c => c.section === col.id)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
              
              return (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: colIdx * 0.1 }}
                  key={col.id} 
                  className={`${col.id === 'story' ? 'w-[340px]' : 'w-64'} shrink-0 flex flex-col gap-5 relative rounded-2xl transition-colors ${dragOverColId === col.id && !dragOverCardId ? 'bg-gray-50 ring-2 ring-gray-200 p-2 -m-2' : ''}`}
                  onDragOver={(e) => handleDragOverCol(e, col.id)}
                  onDrop={(e) => handleDropOnCol(e, col.id)}
                  data-pan-target="true"
                >
                  <h3 className="font-bold text-center mb-4 text-lg pointer-events-none">{col.title}</h3>
                  {columnCards.map((card, cardIdx) => (
                    <div
                      key={card.id}
                      id={`card-${card.id}`}
                      data-card-id={card.id}
                      draggable={isEditMode}
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      onDragOver={(e) => handleDragOverCard(e, card.id)}
                      onDrop={(e) => handleDropOnCard(e, card.id, col.id)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCard(card.id);
                      }}
                      onDoubleClick={() => handleDoubleClick(card)}
                      onPointerDown={(e) => {
                        // Shift+drag on card body starts a card-to-card connection
                        if (!isEditMode || !e.shiftKey) return;
                        if (!canStartConnectionFromCard(card.id)) {
                          showToast('This column already has a selected card in your thread');
                          return;
                        }
                        // Don't intercept node or button clicks
                        const target = e.target as HTMLElement;
                        if (target.closest('[id^="node-"]') || target.closest('button') || target.closest('textarea')) {
                          return;
                        }
                        e.preventDefault();
                        setDrawingLine({
                          startNodeId: `card-body-${card.id}`,
                          endX: e.clientX,
                          endY: e.clientY,
                          startX: e.clientX,
                          startY: e.clientY
                        });
                      }}
                      className={`relative p-5 rounded-xl text-sm cursor-grab active:cursor-grabbing transition-all duration-200 group
                        ${col.color}
                        ${selectedCard === card.id ? 'ring-2 ring-indigo-500 shadow-lg scale-[1.02]' : 'hover:shadow-md border border-black/5'}
                        ${col.id === 'story' ? 'min-h-[240px] text-base p-6 flex items-center justify-center text-center rounded-3xl' : col.id === 'change' ? 'min-h-[180px] flex items-center justify-center text-center rounded-3xl' : 'min-h-[100px]'}
                        ${draggedCardId === card.id ? 'opacity-50 ring-2 ring-indigo-500 scale-105 shadow-2xl z-50' : ''}
                        ${dragOverCardId === card.id ? 'border-t-4 border-t-indigo-500 pt-6' : ''}
                        ${isCardDimmedByThread(card.id) ? 'opacity-35 grayscale' : ''}
                      `}
                    >
                      {/* Left Node (Incoming) */}
                      <div
                        id={`node-left-${card.id}`}
                        className="absolute left-0 top-1/2 z-50 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-transparent cursor-crosshair group"
                        title="Incoming connection (Double-click to break)" 
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (drawingLine && isEditMode) {
                            const toCardId = card.id;
                            const fromCardId = getSourceCardId(drawingLine.startNodeId);
                            if (fromCardId && fromCardId !== toCardId) {
                              createThreadedConnection(fromCardId, toCardId);
                            }
                            setDrawingLine(null);
                          }
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        onDragStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (isEditMode) {
                            const incomingConns = connections.filter(c => c.to === card.id);
                            deleteConnections(incomingConns.flatMap(getConnectionBreakCleanupIds));
                          }
                        }}
                      >
                        <div className="h-4 w-4 rounded-full border border-gray-400 bg-white shadow-sm transition-transform duration-150 group-hover:border-indigo-500 group-hover:scale-125" />
                      </div>
                      
                      {/* Right Node (Outgoing) */}
                      <div
                        id={`node-right-${card.id}`}
                        className="absolute right-0 top-1/2 z-50 flex h-12 w-12 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-transparent cursor-crosshair group"
                        title="Outgoing connection (Double-click to break)"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (!isEditMode) return;
                          if (!canStartConnectionFromCard(card.id)) {
                            showToast('This column already has a selected card in your thread');
                            return;
                          }
                          if (drawingLine && drawingLine.startNodeId === `node-right-${card.id}`) {
                            setDrawingLine(null);
                          } else {
                            setDrawingLine({
                              startNodeId: `node-right-${card.id}`,
                              endX: e.clientX,
                              endY: e.clientY,
                              startX: e.clientX,
                              startY: e.clientY,
                            });
                          }
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        onDragStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (isEditMode) {
                            const outgoingConns = connections.filter(c => c.from === card.id);
                            deleteConnections(outgoingConns.flatMap(getConnectionBreakCleanupIds));
                          }
                        }}
                      >
                        <div className="h-4 w-4 rounded-full border border-gray-400 bg-white shadow-sm transition-transform duration-150 group-hover:border-indigo-500 group-hover:scale-125" />
                      </div>

                      {!!card.starred && <Star size={14} className="absolute top-3 left-3 fill-gray-900 text-gray-900" />}
                      
                      {/* Delete button - visible on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCard(card.id);
                        }}
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
                        title="Delete card"
                      >
                        <Trash2 size={14} />
                      </button>
                      
                      {/* Card Number */}
                      <div className="absolute top-2 right-2 text-xs text-gray-400 font-mono">
                        #{cardIdx + 1}
                      </div>
                      
                      {/* Card content — editable inline */}
                      {editingCardId === card.id ? (
                        <div className="w-full" onClick={e => e.stopPropagation()}>
                          <textarea
                            autoFocus
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onInput={(e) => {
                              const el = e.currentTarget;
                              el.style.height = 'auto';
                              el.style.height = `${el.scrollHeight}px`;
                            }}
                            placeholder="Type your idea..."
                            className="w-full bg-transparent font-medium leading-snug text-gray-900 resize-none outline-none cursor-text whitespace-pre-wrap break-words overflow-hidden"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveEdit(card.id);
                              }
                              if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                          />
                          {!card.content && (
                            <button
                              onClick={() => handleGenerateSingle(card.id, col.id)}
                              disabled={generatingCards[card.id]}
                              className="flex items-center justify-center gap-2 py-1.5 px-2 mt-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {generatingCards[card.id] ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                              Generate Idea
                            </button>
                          )}
                        </div>
                      ) : card.content ? (
                        <div className={`${card.starred ? 'mt-5' : ''} font-medium leading-snug text-gray-900 pb-2 whitespace-pre-wrap`}>
                          {card.content}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 mt-2" onClick={e => e.stopPropagation()}>
                          <textarea
                            autoFocus
                            placeholder="Type your idea..."
                            className="w-full bg-transparent font-medium leading-snug text-gray-900 resize-none outline-none cursor-text whitespace-pre-wrap break-words overflow-hidden"
                            onInput={(e) => {
                              const el = e.currentTarget;
                              el.style.height = 'auto';
                              el.style.height = `${el.scrollHeight}px`;
                            }}
                            onFocus={() => {
                              setEditingCardId(card.id);
                              setEditContent('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleUpdateCard(card.id, e.currentTarget.value);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleGenerateSingle(card.id, col.id)}
                            disabled={generatingCards[card.id]}
                            className="flex items-center justify-center gap-2 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {generatingCards[card.id] ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            Generate Idea
                          </button>
                        </div>
                      )}
                      {card.section !== 'story' && (
                        <div className="absolute bottom-2 left-5 text-[10px] font-mono">
                          <span className={`${(editingCardId === card.id ? editContent.length : card.content?.length || 0) > 100 ? 'text-orange-500' : 'text-gray-400'}`}>
                            {editingCardId === card.id ? editContent.length : card.content?.length || 0} / 100
                          </span>
                          {editingCardId === card.id && editContent.length > 100 && (
                            <span className="text-orange-500 ml-1">Past limit</span>
                          )}
                        </div>
                      )}
                     </div>
                   ))}
                  
                  {col.id !== 'story' && isEditMode && (
                    <button 
                      onClick={() => handleAddCard(col.id)}
                      className="mx-auto w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all mt-2 shadow-sm cursor-pointer"
                    >
                      <Plus size={16} strokeWidth={2.5} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </InfiniteCanvas>

      {activeTutorial && (
        <FloatingVideoPlayer
          tutorial={activeTutorial}
          onClose={() => onCloseTutorial?.()}
        />
      )}

      {/* Render cursor dummy outside so it uses screen coordinates correctly */}
      {drawingLine && (
        <div id="cursor-dummy" style={{ position: 'fixed', left: drawingLine.endX, top: drawingLine.endY, width: 1, height: 1, pointerEvents: 'none', zIndex: 9999 }} />
      )}
      
      {/* Floating Save/Download buttons */}
      {connections.some((connection) => !isCurrentUserConnection(connection)) && (
        <div className="absolute bottom-10 left-10 z-50 flex items-center gap-2 rounded-full border border-gray-200/70 bg-white/95 px-3 py-2 text-xs font-medium text-gray-700 shadow-lg backdrop-blur-sm">
          <span>{showOtherUsersConnections ? "Hide Others' Threads" : "Show Others' Threads"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={showOtherUsersConnections}
            onClick={() => setShowOtherUsersConnections((value) => !value)}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${showOtherUsersConnections ? 'bg-indigo-600' : 'bg-gray-300'}`}
            title={showOtherUsersConnections ? "Hide Others' Threads" : "Show Others' Threads"}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${showOtherUsersConnections ? 'left-[18px]' : 'left-0.5'}`}
            />
          </button>
        </div>
      )}

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-50">
        {connections.length > 0 && isEditMode && (
          <button
            onClick={handleAssembleStory}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-medium shadow-lg transition-all"
          >
            <FileText size={18} />
            Assemble My Story
          </button>
        )}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full shadow-xl border border-gray-200/50 px-3 py-2">
          <button 
            className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
            onClick={() => {
              if (currentSession?.id) {
                window.open(apiUrl(`/api/sessions/${currentSession.id}/export/docx`), '_blank');
              }
            }}
            title="Save as Doc"
          >
            <img src="/doc.svg" alt="" className="h-5 w-5" />
            <span>Save Doc</span>
          </button>
          <div className="w-px h-6 bg-gray-200"></div>
          <button 
            className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
            onClick={() => {
              if (currentSession?.id) {
                window.open(apiUrl(`/api/sessions/${currentSession.id}/export/zip`), '_blank');
              }
            }}
            title="Save Canvas"
          >
            <Download size={18} />
            <span>Save Canvas</span>
          </button>
        </div>
      </div>
    </div>
  );
}
