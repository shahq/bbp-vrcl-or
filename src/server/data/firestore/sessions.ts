import bcrypt from "bcryptjs";
import { normalizeTimerControlMode } from "../../../config/timer";
import { getFirestoreDb } from "../../firebase/app";
import { generateSessionId, generatePassword, hashPassword, type CreateSessionOptions, type CreateSessionResult, type Session } from "../../sessions";
import { getFirestoreCardsBySession } from "./cards";
import { getFirestoreConnectionsBySession } from "./connections";
import { getFirestoreNotes } from "./notes";
import { sessionDocToModel } from "./shared";

const COLLECTION_NAME = "sessions";

function getCollection() {
  return getFirestoreDb().collection(COLLECTION_NAME);
}

function getIsoNow() {
  return new Date().toISOString();
}

export async function createFirestoreSession(
  id: string,
  name: string,
  options: CreateSessionOptions
): Promise<CreateSessionResult> {
  const {
    requirePassword,
    projectClient = "",
    projectBackground = "",
    projectNotes = "",
    timerControlMode,
  } = options;

  let password: string | null = null;
  let passwordHash: string | null = null;

  if (requirePassword) {
    password = generatePassword();
    passwordHash = hashPassword(password);
  }

  const now = getIsoNow();
  await getCollection().doc(id).set({
    name,
    password_hash: passwordHash,
    project_client: projectClient,
    project_background: projectBackground,
    project_notes: projectNotes,
    onboarding_completed: false,
    is_archived: false,
    timer_control_mode: normalizeTimerControlMode(timerControlMode),
    created_at: now,
    updated_at: now,
  });

  return {
    session: {
      id,
      name,
      password_hash: passwordHash,
      project_client: projectClient,
      project_background: projectBackground,
      project_notes: projectNotes,
      onboarding_completed: false,
      is_archived: false,
      timer_control_mode: normalizeTimerControlMode(timerControlMode),
      created_at: now,
      updated_at: now,
    },
    password,
  };
}

export async function getFirestoreSession(id: string): Promise<Session | null> {
  const snapshot = await getCollection().doc(id).get();
  const session = sessionDocToModel(snapshot.id, snapshot.data());
  return session && !session.is_archived ? session : null;
}

export async function getAllFirestoreSessions(): Promise<Session[]> {
  const snapshot = await getCollection().where("is_archived", "==", false).get();
  return snapshot.docs
    .map((doc) => sessionDocToModel(doc.id, doc.data()))
    .filter((session): session is Session => Boolean(session))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function updateFirestoreSession(
  id: string,
  updates: Partial<Omit<Session, "id" | "password_hash" | "created_at">>
): Promise<boolean> {
  const nextUpdates = Object.fromEntries(
    Object.entries({ ...updates, updated_at: getIsoNow() }).filter(([, value]) => value !== undefined)
  );

  if (Object.keys(nextUpdates).length === 0) return false;

  await getCollection().doc(id).set(nextUpdates, { merge: true });
  return true;
}

export async function deleteFirestoreSession(id: string): Promise<boolean> {
  const batch = getFirestoreDb().batch();
  const cards = await getFirestoreCardsBySession(id);
  const connections = await getFirestoreConnectionsBySession(id);
  const notes = await getFirestoreNotes(id);

  cards.forEach((card) => {
    batch.delete(getCollection().doc(id).collection("cards").doc(card.id));
  });

  connections.forEach((connection) => {
    batch.delete(getCollection().doc(id).collection("connections").doc(connection.id));
  });

  notes.forEach((note) => {
    batch.delete(getCollection().doc(id).collection("notes").doc(note.id));
  });

  batch.delete(getCollection().doc(id));
  await batch.commit();

  return true;
}

export async function verifyFirestoreSessionPassword(id: string, password: string): Promise<boolean> {
  const session = await getFirestoreSession(id);
  if (!session) return false;
  if (!session.password_hash) return true;
  return bcrypt.compareSync(password, session.password_hash);
}

export async function completeFirestoreOnboarding(id: string): Promise<boolean> {
  await getCollection().doc(id).set(
    {
      onboarding_completed: true,
      updated_at: getIsoNow(),
    },
    { merge: true }
  );
  return true;
}
