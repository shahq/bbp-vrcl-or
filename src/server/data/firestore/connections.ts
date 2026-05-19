import { getFirestoreDb } from "../../firebase/app";
import * as fileUtils from "../../files";
import type { Connection } from "../../connections";
import { connectionDocToModel } from "./shared";

const COLLECTION_NAME = "sessions";

function connectionsCollection(sessionId: string) {
  return getFirestoreDb().collection(COLLECTION_NAME).doc(sessionId).collection("connections");
}

function getIsoNow() {
  return new Date().toISOString();
}

function getConnectionId(fromCardId: string, toCardId: string, threadId?: string, color?: string, ownerUserId?: string) {
  const ownerKey = ownerUserId || threadId || color || "shared";
  return `${encodeURIComponent(ownerKey)}-${fromCardId}-${toCardId}`;
}

async function writeConnectionMirror(sessionId: string) {
  const connections = await getFirestoreConnectionsBySession(sessionId);
  fileUtils.writeConnections(
    sessionId,
    connections.map((connection) => ({
      id: connection.id,
      from: connection.from_card_id,
      to: connection.to_card_id,
      threadId: connection.thread_id || undefined,
      color: connection.color || undefined,
      ownerUserId: connection.owner_user_id || undefined,
    }))
  );
}

export async function getFirestoreConnectionsBySession(sessionId: string): Promise<Connection[]> {
  const snapshot = await connectionsCollection(sessionId).get();
  return snapshot.docs
    .map((doc) => connectionDocToModel(doc.id, sessionId, doc.data()))
    .filter((connection): connection is Connection => Boolean(connection))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function createFirestoreConnection(
  sessionId: string,
  fromCardId: string,
  toCardId: string,
  threadId?: string,
  color?: string,
  ownerUserId?: string
): Promise<Connection> {
  const id = getConnectionId(fromCardId, toCardId, threadId, color, ownerUserId);
  const createdAt = getIsoNow();

  await connectionsCollection(sessionId).doc(id).set({
    from_card_id: fromCardId,
    to_card_id: toCardId,
    thread_id: threadId || null,
    color: color || null,
    owner_user_id: ownerUserId || null,
    created_at: createdAt,
  });

  await writeConnectionMirror(sessionId);

  return {
    id,
    session_id: sessionId,
    from_card_id: fromCardId,
    to_card_id: toCardId,
    thread_id: threadId || null,
    color: color || null,
    owner_user_id: ownerUserId || null,
    created_at: createdAt,
  };
}

export async function deleteFirestoreConnection(sessionId: string, connectionId: string): Promise<boolean> {
  const ref = connectionsCollection(sessionId).doc(connectionId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    await writeConnectionMirror(sessionId);
    return false;
  }

  await ref.delete();
  await writeConnectionMirror(sessionId);
  return true;
}

export async function deleteFirestoreConnectionsForCard(sessionId: string, cardId: string): Promise<boolean> {
  const connections = await getFirestoreConnectionsBySession(sessionId);
  const batch = getFirestoreDb().batch();

  connections
    .filter((connection) => connection.from_card_id === cardId || connection.to_card_id === cardId)
    .forEach((connection) => {
      batch.delete(connectionsCollection(sessionId).doc(connection.id));
    });

  await batch.commit();
  await writeConnectionMirror(sessionId);
  return true;
}

export async function saveAllFirestoreConnections(
  sessionId: string,
  connections: Array<{ id: string; from: string; to: string; threadId?: string; color?: string; ownerUserId?: string }>
): Promise<void> {
  const existing = await getFirestoreConnectionsBySession(sessionId);
  const batch = getFirestoreDb().batch();

  existing.forEach((connection) => {
    batch.delete(connectionsCollection(sessionId).doc(connection.id));
  });

  connections.forEach((connection) => {
    batch.set(connectionsCollection(sessionId).doc(connection.id), {
      from_card_id: connection.from,
      to_card_id: connection.to,
      thread_id: connection.threadId || null,
      color: connection.color || null,
      owner_user_id: connection.ownerUserId || null,
      created_at: getIsoNow(),
    });
  });

  await batch.commit();
  fileUtils.writeConnections(sessionId, connections);
}
