import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Star, Plus, Download, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { COLUMNS } from '../data';
import { CardData, ConnectionData, Section } from '../types';
import { apiUrl } from '../config/api';
import {
  ACT1_CARD_CHARACTER_LIMIT,
  CANVAS_SECTION_IDS,
} from '../config/canvasSections';
import { motion } from 'motion/react';
import InfiniteCanvas from './InfiniteCanvas';
import { UserCursors } from './UserPresence';
import FloatingVideoPlayer from './FloatingVideoPlayer';
import type { CardDraft, UserPresence } from '../../party/index';
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
  onCardDraft?: (cardId: string, content: string, isActive?: boolean) => void;
  onCardAdd?: (card: Omit<CardData, 'id'>) => Promise<string | undefined>;
  onCursorMove?: (x: number, y: number) => void;
  connections?: ConnectionData[];
  onCardDelete?: (cardId: string) => Promise<void>;
  onCardReorder?: (section: string, cardIds: string[]) => Promise<void>;
  onConnectionCreate?: (from: string, to: string, threadId?: string, color?: string, ownerUserId?: string) => Promise<void>;
  onConnectionDelete?: (connectionId: string) => Promise<void>;
  activeUsers?: UserPresence[];
  liveCardDrafts?: Record<string, CardDraft>;
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

const COLUMN_ORDER: Section[] = [...CANVAS_SECTION_IDS];

const THREAD_LANES = [
  { id: 'thread-red', label: 'Red', color: '#EF4444' },
  { id: 'thread-purple', label: 'Purple', color: '#8B5CF6' },
  { id: 'thread-blue', label: 'Blue', color: '#3B82F6' },
  { id: 'thread-orange', label: 'Orange', color: '#F97316' },
  { id: 'thread-yellow', label: 'Yellow', color: '#EAB308' },
] as const;

type ThreadLane = typeof THREAD_LANES[number];

const THREAD_STORY_CARD_COLORS: Record<ThreadLane['id'], string> = {
  'thread-red': 'bg-red-50 border-red-200',
  'thread-purple': 'bg-purple-50 border-purple-200',
  'thread-blue': 'bg-blue-50 border-blue-200',
  'thread-orange': 'bg-orange-50 border-orange-200',
  'thread-yellow': 'bg-yellow-50 border-yellow-200',
};

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
        strokeWidth={isSelected ? 4 : 2} 
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

export default function Canvas({ onSelectCard, selectedCard, cards, setCards, projectData, showToast, selectedModel, isEditMode, currentSession, onEditRequest, onCardUpdate, onCardDraft, onCardAdd, onCursorMove, connections = [], onCardDelete, onCardReorder, onConnectionCreate, onConnectionDelete, activeUsers = [], liveCardDrafts = {}, currentUserId = '', activeTutorial, onCloseTutorial }: CanvasProps) {
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const [drawingLine, setDrawingLine] = useState<{ startNodeId: string, lane: ThreadLane, side: 'left' | 'right', endX: number, endY: number, startX: number, startY: number } | null>(null);

  const [generatingCards, setGeneratingCards] = useState<Record<string, boolean>>({});
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [activeThreadLane, setActiveThreadLane] = useState<ThreadLane>(THREAD_LANES[0]);
  const [storyLaneOverrides, setStoryLaneOverrides] = useState<Record<string, ThreadLane['id']>>({});
  const [pendingDeleteCardId, setPendingDeleteCardId] = useState<string | null>(null);

  
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
    for (const lane of THREAD_LANES) {
      const rightPrefix = `node-right-${lane.id}-`;
      const leftPrefix = `node-left-${lane.id}-`;
      const bodyPrefix = `card-body-${lane.id}-`;
      if (startNodeId.startsWith(rightPrefix)) {
        return startNodeId.replace(rightPrefix, '');
      }
      if (startNodeId.startsWith(leftPrefix)) {
        return startNodeId.replace(leftPrefix, '');
      }
      if (startNodeId.startsWith(bodyPrefix)) {
        return startNodeId.replace(bodyPrefix, '');
      }
    }
    if (startNodeId.startsWith('node-right-')) {
      return startNodeId.replace('node-right-', '');
    }
    return null;
  }, []);

  const getLaneForConnection = useCallback((connection: ConnectionData): ThreadLane => {
    return THREAD_LANES.find((lane) => connection.threadId === lane.id)
      || THREAD_LANES.find((lane) => connection.color === lane.color)
      || activeThreadLane;
  }, [activeThreadLane]);

  const getStoryCardLane = useCallback((cardId: string): ThreadLane | null => {
    const overrideLane = THREAD_LANES.find((lane) => lane.id === storyLaneOverrides[cardId]);
    if (overrideLane) return overrideLane;

    const incomingStoryConnection = connections.find((connection) => connection.to === cardId);
    return incomingStoryConnection ? getLaneForConnection(incomingStoryConnection) : null;
  }, [connections, getLaneForConnection, storyLaneOverrides]);

  const getCardSection = useCallback((cardId: string) => (
    cards.find((card) => card.id === cardId)?.section
  ), [cards]);

  const getThreadConnections = useCallback((lane: ThreadLane = activeThreadLane) => (
    connections.filter((connection) => (
      connection.threadId ? connection.threadId === lane.id : connection.color === lane.color
    ))
  ), [activeThreadLane, connections]);

  const getActiveThreadConnections = useCallback(() => getThreadConnections(activeThreadLane), [activeThreadLane, getThreadConnections]);

  const hasLaneIncomingConnection = useCallback((cardId: string, lane: ThreadLane) => (
    getThreadConnections(lane).some((connection) => connection.to === cardId)
  ), [getThreadConnections]);

  const hasLaneOutgoingConnection = useCallback((cardId: string, lane: ThreadLane) => (
    getThreadConnections(lane).some((connection) => connection.from === cardId)
  ), [getThreadConnections]);

  const canAssembleFromCallToActionCard = useCallback((cardId: string, lane: ThreadLane) => (
    getCardSection(cardId) === 'change'
    && hasLaneIncomingConnection(cardId, lane)
    && !hasLaneOutgoingConnection(cardId, lane)
  ), [getCardSection, hasLaneIncomingConnection, hasLaneOutgoingConnection]);

  const getDownstreamConnectionIds = useCallback((startCardId: string, sourceConnections = getActiveThreadConnections()) => {
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
  }, [getActiveThreadConnections]);

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

  const activeThreadConnections = getActiveThreadConnections();
  const connectedCardIdsBySection = activeThreadConnections.reduce((sections, connection) => {
    [connection.from, connection.to].forEach((cardId) => {
      const section = getCardSection(cardId);
      if (!section) return;
      if (!sections.has(section)) sections.set(section, new Set<string>());
      sections.get(section)!.add(cardId);
    });
    return sections;
  }, new Map<string, Set<string>>());

  const canStartConnectionFromCard = useCallback((cardId: string, lane: ThreadLane = activeThreadLane) => {
    const section = getCardSection(cardId);
    if (!section || isStorySection(section)) return true;
    const sectionConnections = lane.id === activeThreadLane.id
      ? connectedCardIdsBySection
      : getThreadConnections(lane).reduce((sections, connection) => {
        [connection.from, connection.to].forEach((connectedCardId) => {
          const connectedSection = getCardSection(connectedCardId);
          if (!connectedSection) return;
          if (!sections.has(connectedSection)) sections.set(connectedSection, new Set<string>());
          sections.get(connectedSection)!.add(connectedCardId);
        });
        return sections;
      }, new Map<string, Set<string>>());
    const connectedCardIds = sectionConnections.get(section);
    return !connectedCardIds || connectedCardIds.has(cardId);
  }, [activeThreadLane, connectedCardIdsBySection, getCardSection, getThreadConnections]);

  const getDrawingSourceCardId = useCallback(() => (
    drawingLine ? getSourceCardId(drawingLine.startNodeId) : null
  ), [drawingLine, getSourceCardId]);

  const isSourcePort = useCallback((cardId: string, lane: ThreadLane, side: 'left' | 'right') => {
    return Boolean(
      drawingLine
      && drawingLine.side === side
      && drawingLine.lane.id === lane.id
      && getDrawingSourceCardId() === cardId
    );
  }, [drawingLine, getDrawingSourceCardId]);

  const isViableTargetPort = useCallback((cardId: string, lane: ThreadLane, side: 'left' | 'right') => {
    if (!drawingLine || drawingLine.lane.id !== lane.id || drawingLine.side === side) return false;

    const sourceCardId = getDrawingSourceCardId();
    if (!sourceCardId || sourceCardId === cardId) return false;

    const sourceSection = getCardSection(sourceCardId);
    const targetSection = getCardSection(cardId);
    const sourceColumnIndex = getColumnIndex(sourceSection);
    const targetColumnIndex = getColumnIndex(targetSection);

    return Math.abs(targetColumnIndex - sourceColumnIndex) === 1
      && (drawingLine.side === 'right' ? targetColumnIndex > sourceColumnIndex : targetColumnIndex < sourceColumnIndex)
      && canStartConnectionFromCard(cardId, lane);
  }, [canStartConnectionFromCard, drawingLine, getCardSection, getDrawingSourceCardId]);

  const getPortVisibilityClass = useCallback((cardId: string, lane: ThreadLane, side: 'left' | 'right') => {
    if (isSourcePort(cardId, lane, side) || isViableTargetPort(cardId, lane, side)) {
      return 'opacity-100 scale-110';
    }

    const hasIncoming = hasLaneIncomingConnection(cardId, lane);
    const hasOutgoing = hasLaneOutgoingConnection(cardId, lane);
    if (
      (side === 'left' && (hasIncoming || hasOutgoing))
      || (side === 'right' && (hasOutgoing || hasIncoming))
    ) {
      return 'opacity-100';
    }

    if (drawingLine) {
      return 'opacity-0';
    }
    return 'opacity-25 group-hover:opacity-100';
  }, [drawingLine, hasLaneIncomingConnection, hasLaneOutgoingConnection, isSourcePort, isViableTargetPort]);

  const getConnectionThreadMeta = useCallback((lane: ThreadLane) => {
    return {
      threadId: lane.id,
      color: lane.color,
      ownerUserId: undefined,
    };
  }, []);

  const createThreadedConnection = useCallback(async (fromCardId: string, toCardId: string, lane: ThreadLane = activeThreadLane) => {
    const laneConnections = getThreadConnections(lane);
    if (laneConnections.some((connection) => connection.from === fromCardId && connection.to === toCardId)) return;
    const { threadId, color, ownerUserId } = getConnectionThreadMeta(lane);
    const sourceSection = getCardSection(fromCardId);
    const targetSection = getCardSection(toCardId);

    if (getColumnIndex(targetSection) <= getColumnIndex(sourceSection)) {
      showToast('Connect cards from left to right across the story columns');
      return;
    }

    setActiveThreadLane(lane);

    const cleanupIds = new Set<string>();
    const activeLaneConnections = laneConnections;

    activeLaneConnections
      .filter((connection) => connection.from === fromCardId || connection.to === toCardId)
      .forEach((connection) => getConnectionBreakCleanupIds(connection).forEach((id) => cleanupIds.add(id)));

    if (targetSection) {
      activeLaneConnections
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
  }, [activeThreadLane, deleteConnections, getCardSection, getConnectionBreakCleanupIds, getConnectionThreadMeta, getThreadConnections, onConnectionCreate, showToast]);

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

    const findTargetCardId = (el: Element | null, lane: ThreadLane, side: 'left' | 'right'): string | null => {
      let current: Element | null = el;
      const laneNodeId = `node-${side}-${lane.id}-`;
      while (current) {
        if (current.id && current.id.startsWith(laneNodeId)) {
          return current.id.replace(laneNodeId, '');
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
        const targetSide = drawingLine.side === 'right' ? 'left' : 'right';
        const toCardId = findTargetCardId(el, drawingLine.lane, targetSide);

        if (fromCardId && toCardId && fromCardId !== toCardId) {
          if (drawingLine.side === 'right') {
            createThreadedConnection(fromCardId, toCardId, drawingLine.lane);
          } else {
            createThreadedConnection(toCardId, fromCardId, drawingLine.lane);
          }
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

  const getRemoteDraft = useCallback((cardId: string) => {
    const draft = liveCardDrafts[cardId];
    if (!draft || !draft.isActive || draft.userId === currentUserId || editingCardId === cardId) {
      return null;
    }
    return draft;
  }, [currentUserId, editingCardId, liveCardDrafts]);

  const showCardLockedToast = useCallback((cardId: string) => {
    const draft = getRemoteDraft(cardId);
    if (draft) {
      showToast(`${draft.userName} is editing this card`);
    }
    return !!draft;
  }, [getRemoteDraft, showToast]);

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    if (!isEditMode) return;
    if (showCardLockedToast(cardId)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
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
    if (showCardLockedToast(draggedCardId) || showCardLockedToast(targetCardId)) return;

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
    if (showCardLockedToast(draggedCardId)) return;

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
    if (showCardLockedToast(cardId)) return;
    
    // Prevent infinite loop by returning early if content hasn't changed
    const card = cards.find(c => c.id === cardId);
    if (!card || card.content === content) return;

    setCards(cards.map(c => c.id === cardId ? { ...c, content } : c));
    onCardDraft?.(cardId, content, false);
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
    if (showCardLockedToast(card.id)) return;
    
    setEditingCardId(card.id);
    setEditContent(card.content);
    onCardDraft?.(card.id, card.content, true);
  };

  const handleSaveEdit = async (cardId: string) => {
    if (!isEditMode) return;
    if (showCardLockedToast(cardId)) return;
    
    // Update local state
    setCards(cards.map(c => c.id === cardId ? { ...c, content: editContent } : c));
    onCardDraft?.(cardId, editContent, false);
    
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
    if (editingCardId) {
      const card = cards.find((item) => item.id === editingCardId);
      onCardDraft?.(editingCardId, card?.content || '', false);
    }
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

  const handleEditContentChange = (cardId: string, content: string) => {
    setEditContent(content);
    onCardDraft?.(cardId, content, true);
  };

  const handleGenerateSingle = async (cardId: string, colId: string) => {
    if (!isEditMode) return;
    if (showCardLockedToast(cardId)) return;
    
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

  const handleAssembleStory = (lane: ThreadLane = activeThreadLane, terminalCardId?: string) => {
    if (!isEditMode) {
      showToast('Enter password to assemble stories');
      return;
    }

    const laneConnections = getThreadConnections(lane);
    if (laneConnections.length === 0) {
      showToast(`Connect cards in the ${lane.label.toLowerCase()} thread before assembling a story.`);
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

    const threadStories = buildStoriesForConnections(laneConnections)
      .filter(({ lastNodeId }) => !terminalCardId || lastNodeId === terminalCardId);

    if (threadStories.length === 0) {
      showToast('Connect this How do we get there? card to the selected thread before assembling a story.');
      return;
    }

    if (onCardAdd) {
      threadStories.forEach(({ story, lastNodeId, sourceConnection }, index) => {
        onCardAdd({ section: 'story', content: story, starred: false, order: index })
          .then((generatedCardId) => {
            if (generatedCardId && onConnectionCreate) {
              const sourceLane = THREAD_LANES.find((threadLane) => (
                sourceConnection?.threadId === threadLane.id || sourceConnection?.color === threadLane.color
              )) || lane;

              setStoryLaneOverrides((current) => ({
                ...current,
                [generatedCardId]: sourceLane.id,
              }));

              onConnectionCreate(
                lastNodeId,
                generatedCardId,
                sourceLane.id,
                sourceLane.color,
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

  const deleteCardNow = useCallback(async (cardId: string) => {
    if (!isEditMode) {
      showToast('Enter password to delete cards');
      return;
    }
    if (showCardLockedToast(cardId)) return;

    try {
      await deleteConnections(getCardDeleteCleanupConnectionIds(cardId));
      if (onCardDelete) {
        await onCardDelete(cardId);
      }
      setPendingDeleteCardId((current) => current === cardId ? null : current);
    } catch (error) {
      console.error('Error deleting card:', error);
      showToast('Failed to delete card');
    }
  }, [deleteConnections, getCardDeleteCleanupConnectionIds, isEditMode, onCardDelete, showCardLockedToast, showToast]);

  const requestDeleteCard = useCallback((cardId: string) => {
    if (!isEditMode) {
      showToast('Enter password to delete cards');
      return;
    }
    if (showCardLockedToast(cardId)) return;
    setPendingDeleteCardId((current) => current === cardId ? null : cardId);
  }, [isEditMode, showCardLockedToast, showToast]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedConnectionId) return;
      if (e.key === 'Delete' && selectedCard && isEditMode) {
        const activeEl = document.activeElement;
        const isEditingText = activeEl?.tagName === 'TEXTAREA' || activeEl?.tagName === 'INPUT';
        if (!isEditingText) {
          setPendingDeleteCardId(selectedCard);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCard, selectedConnectionId, isEditMode]);

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
            .map(conn => {
              const lane = getLaneForConnection(conn);
              return (
            <ConnectionLine
              key={conn.id}
              startId={`node-right-${lane.id}-${conn.from}`}
              endId={`node-left-${lane.id}-${conn.to}`}
              connectionId={conn.id}
              color={conn.color || '#6366f1'}
              isSelected={selectedConnectionId === conn.id}
              onSelect={(connectionId) => {
                setActiveThreadLane(lane);
                setSelectedConnectionId(connectionId);
              }}
              interactive={isEditMode}
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
              color={drawingLine.lane.color}
              refreshKey={`${drawingLine.endX}:${drawingLine.endY}`}
            />
          )}

          <div className="mb-8 relative z-10" data-pan-target="true">
            <h2 className="text-2xl font-bold mb-1.5 tracking-tight pointer-events-none">
              Act I: {projectData.client || currentSession?.name || 'Project Name'}
            </h2>
            <p className="text-lg text-gray-800 font-medium pointer-events-none">Set up the story from the audience's viewpoint</p>
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
                  className={`${col.id === 'story' ? 'w-[340px]' : 'w-64'} shrink-0 flex flex-col gap-3 relative rounded-2xl transition-colors ${dragOverColId === col.id && !dragOverCardId ? 'bg-gray-50 ring-2 ring-gray-200 p-2 -m-2' : ''}`}
                  onDragOver={(e) => handleDragOverCol(e, col.id)}
                  onDrop={(e) => handleDropOnCol(e, col.id)}
                  data-pan-target="true"
                >
                  <h3 className="font-bold text-center mb-4 text-lg pointer-events-none">{col.title}</h3>
                  {columnCards.map((card, cardIdx) => {
                    const storyCardLane = card.section === 'story' ? getStoryCardLane(card.id) : null;
                    const remoteDraft = getRemoteDraft(card.id);
                    return (
                      <div
                      key={card.id}
                      id={`card-${card.id}`}
                      data-card-id={card.id}
                      draggable={isEditMode && !remoteDraft}
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
                        if (showCardLockedToast(card.id)) return;
                        if (!canStartConnectionFromCard(card.id, activeThreadLane)) {
                          showToast(`This column already has a selected card in the ${activeThreadLane.label.toLowerCase()} thread`);
                          return;
                        }
                        // Don't intercept node or button clicks
                        const target = e.target as HTMLElement;
                        if (target.closest('[id^="node-"]') || target.closest('button') || target.closest('textarea')) {
                          return;
                        }
                        e.preventDefault();
                        setDrawingLine({
                          startNodeId: `card-body-${activeThreadLane.id}-${card.id}`,
                          lane: activeThreadLane,
                          side: 'right',
                          endX: e.clientX,
                          endY: e.clientY,
                          startX: e.clientX,
                          startY: e.clientY
                        });
                      }}
                      className={`relative p-5 rounded-xl text-sm cursor-grab active:cursor-grabbing transition-all duration-200 group
                        ${storyCardLane ? THREAD_STORY_CARD_COLORS[storyCardLane.id] : col.color}
                        ${col.id === 'change' && selectedCard === card.id ? 'border-black' : ''}
                        ${selectedCard === card.id ? 'ring-2 ring-indigo-500 shadow-lg scale-[1.02]' : col.id === 'change' ? 'hover:shadow-md' : 'hover:shadow-md border border-black/5'}
                        ${col.id === 'story' ? 'min-h-[227px] text-base p-6 flex items-start justify-start text-left rounded-3xl' : col.id === 'change' ? 'min-h-[170px] flex items-start justify-start text-left rounded-3xl' : 'min-h-[170px]'}
                        ${draggedCardId === card.id ? 'opacity-50 ring-2 ring-indigo-500 scale-105 shadow-2xl z-50' : ''}
                        ${dragOverCardId === card.id ? 'border-t-4 border-t-indigo-500 pt-6' : ''}
                      `}
                    >
                      {(storyCardLane ? [storyCardLane] : THREAD_LANES).map((lane) => (
                        <React.Fragment key={lane.id}>
                          <div
                            id={`node-left-${lane.id}-${card.id}`}
                            className={`absolute left-0 z-[60] flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-transparent cursor-crosshair transition-all duration-150 ${
                              col.id === 'place' ? 'opacity-0 pointer-events-none' : storyCardLane ? 'opacity-100' : getPortVisibilityClass(card.id, lane, 'left')
                            }`}
                            style={{ top: `${24 + THREAD_LANES.indexOf(lane) * 13}%` }}
                            title={`${lane.label} incoming connection`}
                            onPointerDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (!isEditMode) return;
                                  if (showCardLockedToast(card.id)) return;
                                  setActiveThreadLane(lane);
                              if (!canStartConnectionFromCard(card.id, lane)) {
                                showToast(`This column already has a selected card in the ${lane.label.toLowerCase()} thread`);
                                return;
                              }
                              if (drawingLine && drawingLine.lane.id === lane.id && drawingLine.side === 'right') {
                                const toCardId = card.id;
                                const fromCardId = getSourceCardId(drawingLine.startNodeId);
                                if (fromCardId && fromCardId !== toCardId) {
                                  createThreadedConnection(fromCardId, toCardId, lane);
                                }
                                setDrawingLine(null);
                              } else {
                                const startNodeId = `node-left-${lane.id}-${card.id}`;
                                if (drawingLine && drawingLine.startNodeId === startNodeId) {
                                  setDrawingLine(null);
                                } else {
                                  setDrawingLine({
                                    startNodeId,
                                    lane,
                                    side: 'left',
                                    endX: e.clientX,
                                    endY: e.clientY,
                                    startX: e.clientX,
                                    startY: e.clientY,
                                  });
                                }
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
                                const incomingConns = connections.filter(c => c.to === card.id && getLaneForConnection(c).id === lane.id);
                                deleteConnections(incomingConns.flatMap(getConnectionBreakCleanupIds));
                              }
                            }}
                          >
                            <div className={`${storyCardLane ? 'h-5 w-5 border-2 shadow-md' : 'h-3 w-3 border shadow-sm'} rounded-full border-white transition-all duration-150 ${
                              isViableTargetPort(card.id, lane, 'left') ? 'ring-4 ring-black/15' : ''
                            }`} style={{ backgroundColor: lane.color }} />
                          </div>

                          {col.id === 'change' ? (
                            <button
                              type="button"
                              id={`node-right-${lane.id}-${card.id}`}
                              className={`absolute right-0 z-[60] flex h-8 w-8 translate-x-1/2 items-center justify-center rounded-full bg-transparent transition-all duration-150 ${
                                canAssembleFromCallToActionCard(card.id, lane) || hasLaneOutgoingConnection(card.id, lane)
                                  ? 'opacity-100 scale-110'
                                  : 'pointer-events-none opacity-0'
                              }`}
                              style={{ top: `${24 + THREAD_LANES.indexOf(lane) * 13}%` }}
                              title={hasLaneOutgoingConnection(card.id, lane) ? `${lane.label} story connected` : `Assemble ${lane.label} story`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!canAssembleFromCallToActionCard(card.id, lane)) return;
                                setActiveThreadLane(lane);
                                handleAssembleStory(lane, card.id);
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (isEditMode) {
                                  const outgoingConns = connections.filter(c => c.from === card.id && getLaneForConnection(c).id === lane.id);
                                  deleteConnections(outgoingConns.flatMap(getConnectionBreakCleanupIds));
                                }
                              }}
                            >
                              <span
                                className={`flex items-center justify-center rounded-full border-white font-bold leading-none text-white transition-all duration-150 ${
                                  canAssembleFromCallToActionCard(card.id, lane)
                                    ? 'h-5 w-5 border-2 text-[13px] shadow-md'
                                    : 'h-3 w-3 border text-[0px] shadow-sm'
                                }`}
                                style={{ backgroundColor: lane.color }}
                              >
                                {canAssembleFromCallToActionCard(card.id, lane) ? '+' : ''}
                              </span>
                            </button>
                          ) : (
                            <div
                              id={`node-right-${lane.id}-${card.id}`}
                              className={`absolute right-0 z-[60] flex h-8 w-8 translate-x-1/2 items-center justify-center rounded-full bg-transparent cursor-crosshair transition-all duration-150 ${
                                col.id === 'story' ? 'opacity-0 pointer-events-none' : getPortVisibilityClass(card.id, lane, 'right')
                              }`}
                              style={{ top: `${24 + THREAD_LANES.indexOf(lane) * 13}%` }}
                              title={`${lane.label} outgoing connection`}
                              onPointerDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (!isEditMode) return;
                                  if (showCardLockedToast(card.id)) return;
                                  setActiveThreadLane(lane);
                                if (!canStartConnectionFromCard(card.id, lane)) {
                                  showToast(`This column already has a selected card in the ${lane.label.toLowerCase()} thread`);
                                  return;
                                }
                                const startNodeId = `node-right-${lane.id}-${card.id}`;
                                if (drawingLine && drawingLine.startNodeId === startNodeId) {
                                  setDrawingLine(null);
                                } else {
                                  setDrawingLine({
                                    startNodeId,
                                    lane,
                                    side: 'right',
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
                                  const outgoingConns = connections.filter(c => c.from === card.id && getLaneForConnection(c).id === lane.id);
                                  deleteConnections(outgoingConns.flatMap(getConnectionBreakCleanupIds));
                                }
                              }}
                            >
                              <div className={`h-3 w-3 rounded-full border border-white shadow-sm transition-all duration-150 ${
                                isSourcePort(card.id, lane, 'right') ? 'ring-4 ring-black/15' : ''
                              }`} style={{ backgroundColor: lane.color }} />
                            </div>
                          )}
                        </React.Fragment>
                      ))}

                      {!!card.starred && <Star size={14} className="absolute top-3 left-3 fill-gray-900 text-gray-900" />}
                      
                      {/* Delete button - visible on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteCard(card.id);
                        }}
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
                        title="Delete card"
                      >
                        <Trash2 size={14} />
                      </button>
                      {pendingDeleteCardId === card.id && (
                        <div
                          className="absolute bottom-9 right-2 z-[70] w-44 rounded-xl border border-red-100 bg-white p-2 shadow-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="mb-2 text-xs font-medium leading-snug text-gray-700">
                            Delete this card?
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPendingDeleteCardId(null)}
                              className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCardNow(card.id)}
                              className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                      
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
                            onChange={(e) => handleEditContentChange(card.id, e.target.value)}
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
                      ) : card.content || remoteDraft ? (
                        <div className={`${card.starred ? 'mt-5' : ''} font-medium leading-snug text-gray-900 pb-2 whitespace-pre-wrap`}>
                          <div className={remoteDraft ? 'text-gray-900' : ''}>
                            {remoteDraft?.content ?? card.content}
                          </div>
                          {remoteDraft && (
                            <div
                              className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-gray-500 shadow-sm ring-1 ring-black/5"
                              title={`${remoteDraft.userName} is editing this card`}
                            >
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: remoteDraft.userColor }}
                              />
                              <span className="truncate">{remoteDraft.userName} is typing</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 mt-2" onClick={e => e.stopPropagation()}>
                          <textarea
                            autoFocus
                            value={editingCardId === card.id ? editContent : ''}
                            placeholder="Type your idea..."
                            className="w-full bg-transparent font-medium leading-snug text-gray-900 resize-none outline-none cursor-text whitespace-pre-wrap break-words overflow-hidden"
                            onChange={(e) => handleEditContentChange(card.id, e.target.value)}
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
                                handleUpdateCard(card.id, editContent || e.currentTarget.value);
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
                          <span className={`${(editingCardId === card.id ? editContent.length : card.content?.length || 0) > ACT1_CARD_CHARACTER_LIMIT ? 'text-orange-500' : 'text-gray-400'}`}>
                            {editingCardId === card.id ? editContent.length : card.content?.length || 0} / {ACT1_CARD_CHARACTER_LIMIT}
                          </span>
                          {editingCardId === card.id && editContent.length > ACT1_CARD_CHARACTER_LIMIT && (
                            <span className="text-orange-500 ml-1">Past limit</span>
                          )}
                        </div>
                      )}
                     </div>
                    );
                  })}
                  
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
      
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-50">
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
