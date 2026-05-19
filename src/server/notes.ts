import type { SessionNote } from "../types";
import { ensureSessionDir, getSessionDir } from "./files";
import fs from "fs";
import path from "path";

const NOTES_FILE = "notes.json";
const DEFAULT_NOTE_ID = "session-notes";

function getNotesPath(sessionId: string) {
  return path.join(getSessionDir(sessionId), NOTES_FILE);
}

function nowIso() {
  return new Date().toISOString();
}

export function normalizeNote(input: Partial<SessionNote>, fallbackId = DEFAULT_NOTE_ID): SessionNote {
  const now = nowIso();
  return {
    id: String(input.id || fallbackId),
    title: String(input.title || "Notes"),
    content: String(input.content || ""),
    createdAt: String(input.createdAt || input.updatedAt || now),
    updatedAt: String(input.updatedAt || now),
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
  };
}

export function readNotes(sessionId: string): SessionNote[] {
  const filePath = getNotesPath(sessionId);
  if (!fs.existsSync(filePath)) return [];

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((note, index) => normalizeNote(note, index === 0 ? DEFAULT_NOTE_ID : `note-${index}`));
  } catch (error) {
    console.warn(`Failed to read notes for ${sessionId}:`, error);
    return [];
  }
}

export function writeNotes(sessionId: string, notes: SessionNote[]): void {
  ensureSessionDir(sessionId);
  fs.writeFileSync(getNotesPath(sessionId), JSON.stringify(notes, null, 2));
}

export function upsertNote(sessionId: string, note: Partial<SessionNote>): SessionNote {
  const notes = readNotes(sessionId);
  const normalized = normalizeNote({ ...note, updatedAt: nowIso() });
  const index = notes.findIndex((existing) => existing.id === normalized.id);

  if (index >= 0) {
    notes[index] = {
      ...notes[index],
      ...normalized,
      createdAt: notes[index].createdAt,
      updatedAt: normalized.updatedAt,
    };
  } else {
    notes.push(normalized);
  }

  writeNotes(sessionId, notes);
  return index >= 0 ? notes[index] : normalized;
}

export function deleteNote(sessionId: string, noteId: string): boolean {
  const notes = readNotes(sessionId);
  const nextNotes = notes.filter((note) => note.id !== noteId);
  writeNotes(sessionId, nextNotes);
  return nextNotes.length !== notes.length;
}

export function replaceNotes(sessionId: string, notes: Partial<SessionNote>[]): SessionNote[] {
  const normalized = notes.map((note, index) => normalizeNote(note, index === 0 ? DEFAULT_NOTE_ID : `note-${index}`));
  writeNotes(sessionId, normalized);
  return normalized;
}
