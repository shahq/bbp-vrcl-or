export type Section = 'place' | 'role' | 'challenge' | 'point_a' | 'point_b' | 'change' | 'story';

export interface CardData {
  id: string;
  section: Section;
  content: string;
  starred: boolean;
  notes?: string;
  order?: number;
}

export interface ConnectionData {
  id: string;
  from: string;
  to: string;
  threadId?: string;
  color?: string;
  ownerUserId?: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  brief: string;
  notes: string;
}

export interface ProjectAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  relativePath: string;
  extractionStatus: 'ready' | 'unsupported' | 'error';
  extractedText: string;
  summary: string;
  note?: string;
}
