import type { SessionNote } from "../../../types";
import { getFirestoreDb } from "../../firebase/app";
import { normalizeNote } from "../../notes";

const COLLECTION_NAME = "sessions";

function getNotesCollection(sessionId: string) {
  return getFirestoreDb().collection(COLLECTION_NAME).doc(sessionId).collection("notes");
}

export async function getFirestoreNotes(sessionId: string): Promise<SessionNote[]> {
  const snapshot = await getNotesCollection(sessionId).orderBy("updatedAt", "asc").get();
  return snapshot.docs.map((doc) => normalizeNote({ id: doc.id, ...doc.data() }));
}

export async function upsertFirestoreNote(sessionId: string, note: Partial<SessionNote>): Promise<SessionNote> {
  const normalized = normalizeNote(note);
  await getNotesCollection(sessionId).doc(normalized.id).set(normalized, { merge: true });
  return normalized;
}

export async function deleteFirestoreNote(sessionId: string, noteId: string): Promise<boolean> {
  await getNotesCollection(sessionId).doc(noteId).delete();
  return true;
}

export async function replaceFirestoreNotes(sessionId: string, notes: Partial<SessionNote>[]): Promise<SessionNote[]> {
  const collection = getNotesCollection(sessionId);
  const existing = await collection.get();
  const batch = getFirestoreDb().batch();

  existing.docs.forEach((doc) => batch.delete(doc.ref));

  const normalized = notes.map((note, index) => normalizeNote(note, index === 0 ? "session-notes" : `note-${index}`));
  normalized.forEach((note) => batch.set(collection.doc(note.id), note));

  await batch.commit();
  return normalized;
}
