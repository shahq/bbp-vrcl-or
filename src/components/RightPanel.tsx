import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { CardData, ProjectAttachment } from '../types';
import { ModelType } from '../services/ai';
import ChatPanel from './chat/ChatPanel';
import type { ProjectBackgroundApplyMode } from './chat/types';
import { apiUrl } from '../config/api';

interface RightPanelProps {
  selectedCard: string | null;
  currentView: 'new' | 'canvas';
  cards: CardData[];
  projectData: { client: string; background: string; notes: string };
  selectedModel: ModelType;
  currentSession?: { id: string; name: string } | null;
  isEditMode?: boolean;
  onApplyProjectBackground?: (text: string, mode: ProjectBackgroundApplyMode) => void;
  onUpdateProjectBackground?: (text: string) => Promise<void>;
  onSaveAndRegenerateProjectBackground?: (text: string) => Promise<void>;
  attachments?: ProjectAttachment[];
}

export default function RightPanel({ 
  selectedCard, 
  currentView, 
  cards, 
  projectData, 
  selectedModel,
  currentSession,
  isEditMode,
  onApplyProjectBackground,
  onUpdateProjectBackground,
  onSaveAndRegenerateProjectBackground,
  attachments = [],
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<'notepad' | 'cards' | 'chat'>('chat');
  const [cardNotes, setCardNotes] = useState<Record<string, string>>({});
  const [isBriefOpen, setIsBriefOpen] = useState(false);
  const [isEditingBrief, setIsEditingBrief] = useState(false);
  const [briefDraft, setBriefDraft] = useState(projectData.background || '');
  const [briefAction, setBriefAction] = useState<'save' | 'regenerate' | null>(null);

  const card = selectedCard ? cards.find(c => c.id === selectedCard) : null;
  const selectedCardLabel = useMemo(() => {
    if (!card) return undefined;
    const rowNumber = cards
      .filter(existingCard => existingCard.section === card.section)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .findIndex(existingCard => existingCard.id === card.id) + 1;
    const sectionName = card.section
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    return `${sectionName}-${rowNumber || 1}`;
  }, [card, cards]);
  const noteStorageKey = useMemo(
    () => `bbp_card_notes_${currentSession?.id || 'local'}`,
    [currentSession?.id]
  );
  const currentNote = card ? cardNotes[card.id] || '' : '';

  useEffect(() => {
    try {
      const stored = localStorage.getItem(noteStorageKey);
      setCardNotes(stored ? JSON.parse(stored) : {});
    } catch (error) {
      console.warn('Failed to load card notes:', error);
      setCardNotes({});
    }
  }, [noteStorageKey]);

  useEffect(() => {
    if (!isEditingBrief) {
      setBriefDraft(projectData.background || '');
    }
  }, [isEditingBrief, projectData.background]);

  const startBriefEdit = () => {
    setBriefDraft(projectData.background || '');
    setIsEditingBrief(true);
  };

  const cancelBriefEdit = () => {
    setBriefDraft(projectData.background || '');
    setIsEditingBrief(false);
  };

  const saveBriefEdit = async () => {
    if (!onUpdateProjectBackground) return;

    setBriefAction('save');
    try {
      await onUpdateProjectBackground(briefDraft);
      setIsEditingBrief(false);
    } finally {
      setBriefAction(null);
    }
  };

  const saveAndRegenerateBriefEdit = async () => {
    if (!onSaveAndRegenerateProjectBackground) return;

    setBriefAction('regenerate');
    try {
      await onSaveAndRegenerateProjectBackground(briefDraft);
      setIsEditingBrief(false);
    } finally {
      setBriefAction(null);
    }
  };

  const isSavingBrief = briefAction !== null;

  const openExport = (format: 'markdown' | 'pdf') => {
    if (!currentSession?.id) return;
    window.open(apiUrl(`/api/sessions/${currentSession.id}/export/${format}`), '_blank');
  };

  const updateCurrentNote = (value: string) => {
    if (!card) return;

    setCardNotes(prev => {
      const next = { ...prev, [card.id]: value };
      try {
        localStorage.setItem(noteStorageKey, JSON.stringify(next));
      } catch (error) {
        console.warn('Failed to save card notes:', error);
      }
      return next;
    });
  };

  if (currentView === 'new') {
    return (
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col shrink-0 h-full">
        <div className="p-8 border-b border-gray-200 shrink-0">
          <div className="text-base text-gray-500 mb-2">Hero: <span className="font-bold text-gray-900">{projectData.client || 'Client Name'}</span></div>
          <div className="text-base text-gray-500">Challenge <span className="font-bold text-gray-900">Description of challenge, brief</span></div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            context={{
              currentView,
              currentSession,
              selectedCard: card,
              projectData,
              isEditMode,
              attachments,
            }}
            selectedModel={selectedModel}
            onApplyProjectBackgroundDraft={onApplyProjectBackground}
            selectedContextLabel={selectedCardLabel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col shrink-0 h-full">
      <div className="border-b border-gray-200 flex flex-col max-h-[35vh] shrink-0">
        <div className="flex w-full items-center justify-between gap-3 px-6 pt-5 pb-3 text-left hover:bg-gray-50 transition-colors">
          <button
            onClick={() => setIsBriefOpen((open) => !open)}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
            aria-expanded={isBriefOpen}
          >
            <div className="min-w-0">
              <div className="truncate text-sm text-gray-500">
                Project overview <span className="font-bold text-gray-900">{projectData.client || currentSession?.name || 'Project Name'}</span>
              </div>
            </div>
            <div className="shrink-0 text-gray-400">
              {isBriefOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </div>
          </button>
          {isBriefOpen && onUpdateProjectBackground && !isEditingBrief && (
            <button
              type="button"
              onClick={startBriefEdit}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-900"
              aria-label="Edit project overview"
              title="Edit project overview"
            >
              <img src="/edit.svg" alt="" className="h-4 w-4" />
            </button>
          )}
        </div>
        {isBriefOpen && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar pb-2">
              <div className="px-6 pr-8">
              {isEditingBrief ? (
                <div className="space-y-3">
                  <textarea
                    className="min-h-40 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm leading-relaxed text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-50"
                    value={briefDraft}
                    onChange={(event) => setBriefDraft(event.target.value)}
                    disabled={isSavingBrief}
                    aria-label="Project overview text"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelBriefEdit}
                      disabled={isSavingBrief}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    {onSaveAndRegenerateProjectBackground && (
                      <button
                        type="button"
                        onClick={saveAndRegenerateBriefEdit}
                        disabled={isSavingBrief}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-60"
                      >
                        {briefAction === 'regenerate' ? 'Regenerating...' : 'Save & regenerate cards'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={saveBriefEdit}
                      disabled={isSavingBrief}
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
                    >
                      {briefAction === 'save' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed">
                  {projectData.background || "No background description provided."}
                </p>
              )}
              </div>
            </div>
            <div className="shrink-0 border-t border-gray-100 px-6 py-3">
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <span className="font-semibold text-gray-900">Export:</span>
                <button
                  type="button"
                  onClick={() => openExport('markdown')}
                  className="flex items-center gap-1.5 text-blue-600 underline underline-offset-2 transition-colors hover:text-blue-700"
                  title="Export as document"
                >
                  <img src="/doc.svg" alt="" className="h-5 w-5" />
                  Doc
                </button>
                <button
                  type="button"
                  onClick={() => openExport('pdf')}
                  className="flex items-center gap-1.5 text-blue-600 underline underline-offset-2 transition-colors hover:text-blue-700"
                  title="Export as PDF"
                >
                  <img src="/pdf.svg" alt="" className="h-5 w-5" />
                  PDF
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
        <button 
          className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase transition-colors ${activeTab === 'notepad' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          onClick={() => setActiveTab('notepad')}
        >
          Notepad
        </button>
        <button 
          className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase border-l border-gray-200 transition-colors ${activeTab === 'cards' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          onClick={() => setActiveTab('cards')}
        >
          Cards
        </button>
        <button 
          className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase border-l border-gray-200 transition-colors ${activeTab === 'chat' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'cards' && card && (
          <div className="flex-1 overflow-y-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 custom-scrollbar">
            <h3 className="text-2xl font-bold mb-6">Act I</h3>
            <div className="text-base font-bold mb-3 capitalize">Your {card.section.replace('_', ' ')}</div>
            <div className={`p-5 rounded-xl mb-8 relative border border-black/5 shadow-sm
              ${card.section === 'place' ? 'bg-[#e8f5e9]' : ''}
              ${card.section === 'role' ? 'bg-[#ffebee]' : ''}
              ${card.section === 'challenge' ? 'bg-[#e3f2fd]' : ''}
              ${card.section === 'point_a' ? 'bg-[#f3e5f5]' : ''}
              ${card.section === 'point_b' ? 'bg-[#e0f7fa]' : ''}
              ${card.section === 'change' ? 'bg-white border-2 border-gray-800' : ''}
              ${card.section === 'story' ? 'bg-[#fff9c4]' : ''}
            `}>
              {card.starred && <Star size={16} className="absolute top-4 left-4 text-gray-900 fill-gray-900" />}
              <div className={`text-base font-medium ${card.starred ? 'mt-6' : ''}`}>
                {card.content}
              </div>
            </div>
            
            <div className="font-bold text-base mb-3">Add Notes</div>
            <textarea 
              className="w-full h-40 p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base text-gray-600 leading-relaxed shadow-sm"
              placeholder="Capture a thought, objection, or detail for this card..."
              value={currentNote}
              onChange={(e) => updateCurrentNote(e.target.value)}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-400">
                {currentNote.length > 0 ? `${currentNote.length} characters` : 'Saved per selected card'}
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <Check size={16} />
                Auto-saved locally
              </div>
            </div>
          </div>
        )}
        {activeTab === 'cards' && !card && (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-lg p-8">
            Select a card to edit
          </div>
        )}
        {activeTab === 'chat' && (
          <div className="flex-1 overflow-hidden">
            <ChatPanel
              context={{
                currentView,
                currentSession,
                selectedCard: card,
                projectData,
                isEditMode,
                attachments,
              }}
              selectedModel={selectedModel}
              selectedContextLabel={selectedCardLabel}
            />
          </div>
        )}
        {activeTab === 'notepad' && (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-lg p-8">
            Notepad interface
          </div>
        )}
      </div>
    </div>
  );
}
