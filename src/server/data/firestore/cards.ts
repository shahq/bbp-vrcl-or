import { getFirestoreDb } from "../../firebase/app";
import * as fileUtils from "../../files";
import type { Card } from "../../cards";
import { cardDocToModel } from "./shared";

const COLLECTION_NAME = "sessions";

function cardsCollection(sessionId: string) {
  return getFirestoreDb().collection(COLLECTION_NAME).doc(sessionId).collection("cards");
}

function getIsoNow() {
  return new Date().toISOString();
}

export async function getFirestoreCardsBySession(sessionId: string): Promise<Card[]> {
  const snapshot = await cardsCollection(sessionId).get();
  return snapshot.docs
    .map((doc) => cardDocToModel(doc.id, sessionId, doc.data()))
    .filter((card): card is Card => Boolean(card))
    .sort((a, b) => {
      if (a.section === b.section) {
        return a.order_index - b.order_index;
      }
      return a.section.localeCompare(b.section);
    });
}

export async function getFirestoreNextOrderIndex(sessionId: string, section: string): Promise<number> {
  const cards = await getFirestoreCardsBySession(sessionId);
  const maxOrder = cards
    .filter((card) => card.section === section)
    .reduce((max, card) => Math.max(max, card.order_index), -1);
  return maxOrder + 1;
}

export async function createFirestoreCard(
  sessionId: string,
  cardId: string,
  section: string,
  content: string,
  order = 0,
  starred = false
): Promise<Card> {
  const filePath = fileUtils.writeCardFile(sessionId, cardId, section, content, order, starred);
  const now = getIsoNow();

  await cardsCollection(sessionId).doc(cardId).set({
    section,
    content,
    file_path: filePath,
    order_index: order,
    starred,
    created_at: now,
    updated_at: now,
  });

  return {
    id: cardId,
    session_id: sessionId,
    section,
    content,
    file_path: filePath,
    order_index: order,
    starred,
    created_at: now,
    updated_at: now,
  };
}

export async function updateFirestoreCard(
  sessionId: string,
  cardId: string,
  updates: Partial<Pick<Card, "section" | "order_index" | "starred">>,
  newContent?: string
): Promise<boolean> {
  const cardRef = cardsCollection(sessionId).doc(cardId);
  const snapshot = await cardRef.get();
  const current = cardDocToModel(cardId, sessionId, snapshot.data());
  if (!current) return false;

  fileUtils.updateCardFile(current.file_path, {
    section: updates.section,
    order: updates.order_index,
    starred: updates.starred,
  }, newContent);

  const nextData = Object.fromEntries(
    Object.entries({
      ...updates,
      content: newContent ?? current.content ?? "",
      updated_at: getIsoNow(),
    }).filter(([, value]) => value !== undefined)
  );

  await cardRef.set(nextData, { merge: true });
  return true;
}

export async function deleteFirestoreCard(sessionId: string, cardId: string): Promise<boolean> {
  const snapshot = await cardsCollection(sessionId).doc(cardId).get();
  const current = cardDocToModel(cardId, sessionId, snapshot.data());
  if (!current) return false;

  fileUtils.deleteCardFile(current.file_path);
  await cardsCollection(sessionId).doc(cardId).delete();
  return true;
}

export async function reorderFirestoreCards(sessionId: string, section: string, cardIds: string[]): Promise<boolean> {
  const batch = getFirestoreDb().batch();

  for (let i = 0; i < cardIds.length; i += 1) {
    const cardId = cardIds[i];
    const cardRef = cardsCollection(sessionId).doc(cardId);
    const snapshot = await cardRef.get();
    const current = cardDocToModel(cardId, sessionId, snapshot.data());
    if (current) {
      fileUtils.updateCardFile(current.file_path, { order: i, section });
    }
    batch.set(cardRef, { order_index: i, section, updated_at: getIsoNow() }, { merge: true });
  }

  await batch.commit();
  return true;
}
