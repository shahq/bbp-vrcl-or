#!/usr/bin/env node

const baseUrl = (process.env.API_BASE_URL || "http://localhost:3107").replace(/\/$/, "");
const adminPassword = process.env.ADMIN_PASSWORD || "shazam!";
const smokeRequestCookie = process.env.SMOKE_REQUEST_COOKIE || "";

const createdSessionIds = [];
let adminSessionId = "";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(adminSessionId ? { "x-admin-session": adminSessionId } : {}),
      ...(smokeRequestCookie ? { Cookie: smokeRequestCookie } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed (${response.status}): ${text}`);
  }
  return data;
}

async function cleanup() {
  for (const sessionId of createdSessionIds.reverse()) {
    try {
      await request(`/api/sessions/${sessionId}`, { method: "DELETE" });
    } catch (error) {
      console.warn(`Cleanup failed for ${sessionId}:`, error.message);
    }
  }
}

async function main() {
  console.log(`Running provider API smoke against ${baseUrl}`);

  const login = await request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password: adminPassword }),
  });
  assert(typeof login.sessionId === "string" && login.sessionId.length > 0, "Admin login did not return sessionId");
  adminSessionId = login.sessionId;

  const create = await request("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      name: `Provider smoke ${Date.now()}`,
      require_password: false,
      project_client: "Verification Client",
      project_background: "Initial background",
      project_notes: "Initial notes",
    }),
  });
  const sessionId = create.session?.id;
  assert(typeof sessionId === "string" && sessionId.length > 0, "Create session did not return session.id");
  createdSessionIds.push(sessionId);
  assert(create.session.has_password === false, "Created open session should not have a password");
  assert(create.session.timer_control_mode === "admin", "Created session should default timer_control_mode to admin");

  const cardA = await request(`/api/sessions/${sessionId}/cards`, {
    method: "POST",
    body: JSON.stringify({ section: "place", content: "Setting card", starred: true }),
  });
  const cardB = await request(`/api/sessions/${sessionId}/cards`, {
    method: "POST",
    body: JSON.stringify({ section: "role", content: "Role card" }),
  });
  const cardAId = cardA.card?.id;
  const cardBId = cardB.card?.id;
  assert(cardAId && cardBId, "Card creation did not return card IDs");
  assert(cardA.card.section === "place" && cardA.card.content === "Setting card", "Card A payload mismatch");
  assert(cardB.card.section === "role" && cardB.card.content === "Role card", "Card B payload mismatch");

  const updateCard = await request(`/api/sessions/${sessionId}/cards/${cardAId}`, {
    method: "PUT",
    body: JSON.stringify({ content: "Updated setting card", order: 0, starred: false }),
  });
  assert(updateCard.success === true, "Card update did not return success");

  const reorder = await request(`/api/sessions/${sessionId}/cards/reorder`, {
    method: "POST",
    body: JSON.stringify({ section: "place", card_ids: [cardAId] }),
  });
  assert(reorder.success === true, "Card reorder did not return success");

  const connection = await request(`/api/sessions/${sessionId}/connections`, {
    method: "POST",
    body: JSON.stringify({
      from: cardAId,
      to: cardBId,
      threadId: "thread-red",
      color: "red",
      ownerUserId: "u1",
    }),
  });
  const connectionId = connection.connection?.id;
  assert(connectionId, "Connection creation did not return connection.id");
  assert(connection.connection.from === cardAId && connection.connection.to === cardBId, "Connection payload mismatch");

  const readSession = await request(`/api/sessions/${sessionId}`);
  assert(readSession.session?.id === sessionId, "Session read did not return created session");
  assert(readSession.cards.some((card) => card.id === cardAId), "Session read did not include card A");
  assert(readSession.cards.some((card) => card.id === cardBId), "Session read did not include card B");
  assert(readSession.connections.some((item) => item.id === connectionId), "Session read did not include connection");
  assert(Array.isArray(readSession.notes), "Session read did not include notes array");

  const deleteConnection = await request(`/api/sessions/${sessionId}/connections/${connectionId}`, {
    method: "DELETE",
  });
  assert(deleteConnection.success === true, "Connection delete did not return success");

  const createNote = await request(`/api/sessions/${sessionId}/notes`, {
    method: "POST",
    body: JSON.stringify({ id: "session-notes", title: "Notes", content: "First note" }),
  });
  assert(createNote.note?.id === "session-notes", "Note create did not preserve note id");

  const updateNote = await request(`/api/sessions/${sessionId}/notes/session-notes`, {
    method: "PUT",
    body: JSON.stringify({ title: "Notes", content: "Updated note" }),
  });
  assert(updateNote.note?.content === "Updated note", "Note update did not return updated content");

  const listNotes = await request(`/api/sessions/${sessionId}/notes`);
  assert(listNotes.notes.some((note) => note.id === "session-notes"), "Notes list did not include session note");

  const deleteNote = await request(`/api/sessions/${sessionId}/notes/session-notes`, {
    method: "DELETE",
  });
  assert(deleteNote.success === true, "Note delete did not return success");

  const deleteSession = await request(`/api/sessions/${sessionId}`, { method: "DELETE" });
  assert(deleteSession.success === true, "Session delete did not return success");
  createdSessionIds.pop();

  console.log("Provider API smoke passed.");
}

main()
  .catch(async (error) => {
    console.error(error.message);
    await cleanup();
    process.exitCode = 1;
  });
