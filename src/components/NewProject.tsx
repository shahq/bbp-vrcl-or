import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UploadCloud, Save, Loader2, FileText, Image as ImageIcon, Pencil, Trash2, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, CircleDashed, Sparkles, Download } from 'lucide-react';
import type { ProjectAttachment } from '../types';
import { apiUrl } from '../config/api';

interface NewProjectProps {
  projectName: string;
  sessionId?: string;
  onRenameProject: (name: string) => Promise<void>;
  onStart: () => void;
  onSaveChanges: () => Promise<void>;
  onRegenerateCards?: () => Promise<void>;
  projectData: { client: string; background: string; notes: string };
  setProjectData: React.Dispatch<React.SetStateAction<{ client: string; background: string; notes: string }>>;
  isGenerating: boolean;
  isSavingProjectChanges: boolean;
  isRegeneratingCards?: boolean;
  showGenerateCanvasButton?: boolean;
  showRegenerateCardsButton?: boolean;
  attachments: ProjectAttachment[];
  isUploadingAttachments: boolean;
  isGeneratingBriefFromUploads: boolean;
  onUploadFiles: (files: FileList | null) => void;
  onUploadSessionArchive: (file: File | null) => void;
  onGenerateBriefFromUploads: () => Promise<void>;
  onUseAttachmentText: (attachment: ProjectAttachment, target: 'background' | 'notes', source: 'summary' | 'full') => void;
  onRenameAttachment: (attachmentId: string, name: string) => Promise<void>;
  onUpdateAttachmentNote: (attachmentId: string, note: string) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  canManageProjectName?: boolean;
  canManageAttachments?: boolean;
}

export default function NewProject({
  projectName,
  sessionId,
  onRenameProject,
  onStart,
  onSaveChanges,
  onRegenerateCards,
  projectData,
  setProjectData,
  isGenerating,
  isSavingProjectChanges,
  isRegeneratingCards = false,
  showGenerateCanvasButton = true,
  showRegenerateCardsButton = false,
  attachments,
  isUploadingAttachments,
  isGeneratingBriefFromUploads,
  onUploadFiles,
  onUploadSessionArchive,
  onGenerateBriefFromUploads,
  onUseAttachmentText,
  onRenameAttachment,
  onUpdateAttachmentNote,
  onDeleteAttachment,
  canManageProjectName = true,
  canManageAttachments = true,
}: NewProjectProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sessionArchiveInputRef = useRef<HTMLInputElement | null>(null);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(projectName);
  const [expandedAttachments, setExpandedAttachments] = useState<Record<string, boolean>>({});
  const [editingAttachmentNameId, setEditingAttachmentNameId] = useState<string | null>(null);
  const [attachmentNameDrafts, setAttachmentNameDrafts] = useState<Record<string, string>>({});
  const [attachmentNoteDrafts, setAttachmentNoteDrafts] = useState<Record<string, string>>({});
  const [savingAttachmentNoteId, setSavingAttachmentNoteId] = useState<string | null>(null);
  const [savedBackground, setSavedBackground] = useState(projectData.background);

  useEffect(() => {
    setSavedBackground(projectData.background);
  }, [sessionId]);

  const sortedAttachments = useMemo(() => attachments, [attachments]);
  const hasUsableUploads = sortedAttachments.some((attachment) =>
    attachment.summary.trim() || attachment.extractedText.trim() || attachment.note?.trim()
  );

  const handleProjectNameSave = async () => {
    const trimmed = projectNameDraft.trim();
    if (!trimmed || trimmed === projectName) {
      setProjectNameDraft(projectName);
      setIsEditingProjectName(false);
      return;
    }

    await onRenameProject(trimmed);
    setIsEditingProjectName(false);
  };

  const getStatusMeta = (status: ProjectAttachment['extractionStatus']) => {
    if (status === 'ready') {
      return {
        icon: <CheckCircle2 size={14} />,
        label: 'Ready',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }

    if (status === 'error') {
      return {
        icon: <AlertTriangle size={14} />,
        label: 'Extraction failed',
        className: 'bg-red-50 text-red-700 border-red-200',
      };
    }

    return {
      icon: <CircleDashed size={14} />,
      label: 'Stored only',
      className: 'bg-gray-50 text-gray-600 border-gray-200',
    };
  };

  const getAttachmentNoteDraft = (attachment: ProjectAttachment) => {
    return attachmentNoteDrafts[attachment.id] ?? attachment.note ?? '';
  };

  const getAttachmentNameDraft = (attachment: ProjectAttachment) => {
    return attachmentNameDrafts[attachment.id] ?? attachment.name;
  };

  const handleAttachmentNameSave = async (attachment: ProjectAttachment) => {
    const nextName = getAttachmentNameDraft(attachment).trim();
    if (!nextName || nextName === attachment.name) {
      setAttachmentNameDrafts((prev) => ({ ...prev, [attachment.id]: attachment.name }));
      setEditingAttachmentNameId(null);
      return;
    }

    await onRenameAttachment(attachment.id, nextName);
    setEditingAttachmentNameId(null);
  };

  const handleAttachmentNoteBlur = async (attachment: ProjectAttachment) => {
    const nextNote = getAttachmentNoteDraft(attachment);
    if ((attachment.note || '') === nextNote) return;

    setSavingAttachmentNoteId(attachment.id);
    try {
      await onUpdateAttachmentNote(attachment.id, nextNote);
    } finally {
      setSavingAttachmentNoteId(null);
    }
  };

  const handleDownloadOverviewDoc = () => {
    if (!sessionId) return;
    window.open(apiUrl(`/api/sessions/${sessionId}/export/overview-docx`), '_blank');
  };

  const isDirty = projectData.background !== savedBackground;
  const canExport = projectData.background.trim().length > 0;

  const handleSaveOverview = async () => {
    await onSaveChanges();
    setSavedBackground(projectData.background);
  };

  return (
    <div className="h-full flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto p-8">
      {canManageAttachments && (
        <div className="flex justify-end mb-4">
          <input
            ref={sessionArchiveInputRef}
            type="file"
            className="hidden"
            accept=".zip,application/zip,application/x-zip-compressed"
            onChange={(e) => {
              onUploadSessionArchive(e.target.files?.[0] || null);
              e.target.value = '';
            }}
          />
          <button
            disabled={isGenerating || isUploadingAttachments || isGeneratingBriefFromUploads}
            onClick={() => sessionArchiveInputRef.current?.click()}
            className="flex items-center gap-1.5 text-sm text-[#2E94FB] hover:text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-default border-l border-gray-300 pl-3"
          >
            <UploadCloud size={16} className="text-black" />
            Upload Session
          </button>
        </div>
      )}
      <div className="mb-14">
        {isEditingProjectName ? (
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={projectNameDraft}
              onChange={(e) => setProjectNameDraft(e.target.value)}
              onBlur={handleProjectNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleProjectNameSave();
                if (e.key === 'Escape') {
                  setProjectNameDraft(projectName);
                  setIsEditingProjectName(false);
                }
              }}
              className="text-[1.75rem] font-bold tracking-tight border-b border-gray-300 bg-transparent outline-none focus:border-gray-900 min-w-[20rem]"
              autoFocus
            />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <h1 className="text-[2rem] font-bold tracking-tight">{projectName || 'Project Name'}</h1>
            {canManageProjectName && (
              <button
                onClick={() => {
                  setProjectNameDraft(projectName);
                  setIsEditingProjectName(true);
                }}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                title="Edit project name"
              >
                <Pencil size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {canManageAttachments && (
      <>
      <div className="grid grid-cols-[320px_1px_1fr] gap-8 items-start mb-14">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp"
            onChange={(e) => onUploadFiles(e.target.files)}
          />
        <button
          disabled={isGenerating || isUploadingAttachments}
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 border border-gray-300 rounded-none bg-gray-50 hover:bg-gray-100 font-semibold text-base transition-colors disabled:opacity-50"
        >
          Upload Docs <UploadCloud size={22} />
        </button>
        </div>
        <div className="self-stretch w-px bg-gray-300" />
        <div>
          <div className="text-lg font-bold mb-4">Documents</div>
          <div className="space-y-2">
            {sortedAttachments.length === 0 ? (
              <div className="text-gray-500 text-sm py-3">
                Upload your brief, RFP proposal, or any other project background document
              </div>
            ) : (
              sortedAttachments.map((attachment) => {
                const isImage = attachment.mimeType.startsWith('image/');
                const expanded = !!expandedAttachments[attachment.id];
                const statusMeta = getStatusMeta(attachment.extractionStatus);

                return (
                  <div key={attachment.id} className="border-b border-gray-200 pb-2">
                    <div className="flex items-center gap-3">
                      <div className="text-gray-500">
                        {isImage ? <ImageIcon size={18} /> : <FileText size={18} />}
                      </div>
                      <button
                        onClick={() =>
                          setExpandedAttachments((prev) => ({ ...prev, [attachment.id]: !prev[attachment.id] }))
                        }
                        className="flex items-center gap-2 text-left min-w-0"
                        title={expanded ? 'Collapse upload' : 'Expand upload'}
                      >
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      {editingAttachmentNameId === attachment.id ? (
                        <input
                          value={getAttachmentNameDraft(attachment)}
                          onChange={(e) =>
                            setAttachmentNameDrafts((prev) => ({
                              ...prev,
                              [attachment.id]: e.target.value,
                            }))
                          }
                          onBlur={() => handleAttachmentNameSave(attachment)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAttachmentNameSave(attachment);
                            if (e.key === 'Escape') {
                              setAttachmentNameDrafts((prev) => ({ ...prev, [attachment.id]: attachment.name }));
                              setEditingAttachmentNameId(null);
                            }
                          }}
                          className="min-w-0 flex-1 border-b border-gray-300 bg-transparent text-base text-gray-900 outline-none focus:border-gray-900"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() =>
                            setExpandedAttachments((prev) => ({ ...prev, [attachment.id]: !prev[attachment.id] }))
                          }
                          className="min-w-0 flex-1 truncate text-left text-base text-gray-900"
                          title={attachment.name}
                        >
                          {attachment.name}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setAttachmentNameDrafts((prev) => ({ ...prev, [attachment.id]: attachment.name }));
                          setEditingAttachmentNameId(attachment.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
                        title="Rename upload"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => onDeleteAttachment(attachment.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete upload"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {expanded && (
                      <div className="mt-3 ml-9 rounded-lg bg-gray-50 border border-gray-200 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${statusMeta.className}`}>
                            {statusMeta.icon}
                            {statusMeta.label}
                          </div>
                          <div className="text-xs text-gray-500">
                            {(attachment.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <div className="mb-4 text-sm text-gray-700 whitespace-pre-wrap">
                          {attachment.summary}
                        </div>
                        {attachment.extractedText && (
                          <details className="mb-4 rounded-md border border-gray-200 bg-white">
                            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-700">
                              Preview extracted text
                            </summary>
                            <div className="max-h-48 overflow-auto border-t border-gray-100 p-3 text-xs leading-5 text-gray-600 whitespace-pre-wrap custom-scrollbar">
                              {attachment.extractedText}
                            </div>
                          </details>
                        )}
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Source note
                        </label>
                        <textarea
                          value={getAttachmentNoteDraft(attachment)}
                          onChange={(e) =>
                            setAttachmentNoteDrafts((prev) => ({
                              ...prev,
                              [attachment.id]: e.target.value,
                            }))
                          }
                          onBlur={() => handleAttachmentNoteBlur(attachment)}
                          className="mb-3 h-20 w-full resize-none rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                          placeholder="Add why this source matters, which parts to trust, or what to look for..."
                        />
                        {savingAttachmentNoteId === attachment.id && (
                          <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
                            <Loader2 size={12} className="animate-spin" />
                            Saving source note
                          </div>
                        )}
                        {/* Dormant — per-upload insert buttons hidden but preserved */}
                        <div className="flex flex-wrap gap-2 hidden">
                          <button
                            onClick={() => onUseAttachmentText(attachment, 'background', 'summary')}
                            className="px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100"
                          >
                            Add summary to overview
                          </button>
                          {attachment.extractedText && (
                            <button
                              onClick={() => onUseAttachmentText(attachment, 'background', 'full')}
                              className="px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100"
                            >
                              Add full text to overview
                            </button>
                          )}
                          <button
                            onClick={() => onUseAttachmentText(attachment, 'notes', 'summary')}
                            className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
                          >
                            Add summary to notes
                          </button>
                          {attachment.extractedText && (
                            <button
                              onClick={() => onUseAttachmentText(attachment, 'notes', 'full')}
                              className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
                            >
                              Add full text to notes
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {hasUsableUploads && (
            <button
              disabled={isGenerating || isUploadingAttachments || isGeneratingBriefFromUploads}
              onClick={onGenerateBriefFromUploads}
              className="mt-4 inline-flex items-center justify-center gap-3 px-6 py-3 border border-black bg-black text-white hover:bg-gray-900 font-semibold text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGeneratingBriefFromUploads ? (
                <>
                  Generating overview <Loader2 size={18} className="animate-spin" />
                </>
              ) : (
                <>
                  Generate Project Overview <Sparkles size={18} />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 mb-10">
        <div className="h-px flex-1 border-t border-dashed border-gray-400" />
        <div className="text-lg font-bold">OR</div>
        <div className="h-px flex-1 border-t border-dashed border-gray-400" />
      </div>
      </>
      )}

      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <label className="text-[1.75rem] font-bold">Project Overview</label>
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={handleSaveOverview}
              disabled={!isDirty || isGenerating || isSavingProjectChanges || isRegeneratingCards}
              className={`flex items-center gap-1.5 transition-colors ${
                isDirty
                  ? 'text-[#2E94FB] hover:text-blue-700'
                  : 'text-gray-400 opacity-50 cursor-default'
              }`}
            >
              <Save size={16} className={isDirty ? 'text-black' : 'text-gray-400'} />
              Save Changes
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={handleDownloadOverviewDoc}
              disabled={!canExport || isGenerating || isSavingProjectChanges || isRegeneratingCards}
              className={`flex items-center gap-1.5 transition-colors ${
                canExport
                  ? 'text-[#2E94FB] hover:text-blue-700'
                  : 'text-gray-400 opacity-50 cursor-default'
              }`}
            >
              <FileText size={16} className={canExport ? 'text-black' : 'text-gray-400'} />
              Export as: Word Doc
            </button>
          </div>
        </div>
        <textarea
          value={projectData.background}
          onChange={(e) => setProjectData(p => ({ ...p, background: e.target.value }))}
          className="w-full min-h-[420px] border border-gray-300 rounded-none p-8 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base leading-relaxed disabled:opacity-50"
          placeholder={`No brief? please describe the project here with as much detail as possible\n\nOR\n\nUse the AI assistant on the right to help write a Project Overview`}
          disabled={isGenerating}
        ></textarea>
        {showGenerateCanvasButton && (
          <button
            onClick={onStart}
            disabled={isGenerating || isSavingProjectChanges || isRegeneratingCards}
            className="w-full mt-6 py-4 bg-black text-white hover:bg-gray-900 border border-black rounded-none font-bold flex items-center justify-center gap-3 text-lg transition-colors disabled:opacity-70"
          >
            {isGenerating ? (
              <>Generating Act I Ideas <Loader2 size={20} className="animate-spin" /></>
            ) : (
              <>Generate Canvas</>
            )}
          </button>
        )}
        {showRegenerateCardsButton && onRegenerateCards && (
          <button
            onClick={() => onRegenerateCards()}
            disabled={isGenerating || isSavingProjectChanges || isRegeneratingCards}
            className="w-full mt-6 py-4 bg-black text-white hover:bg-gray-900 border border-black rounded-none font-bold flex items-center justify-center gap-3 text-lg transition-colors disabled:opacity-70"
          >
            {isRegeneratingCards ? (
              <>Regenerating cards <Loader2 size={20} className="animate-spin" /></>
            ) : (
              <>Generate Canvas</>
            )}
          </button>
        )}
      </div>

      <div className="mt-10">
        <label className="block text-lg font-bold mb-4">Additional Notes</label>
        <textarea 
          value={projectData.notes}
          onChange={(e) => setProjectData(p => ({ ...p, notes: e.target.value }))}
          className="w-full h-40 border border-gray-300 rounded-none p-5 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base disabled:opacity-50"
          placeholder="Type description or add more details"
          disabled={isGenerating}
        ></textarea>
      </div>
      </div>
    </div>
  );
}
