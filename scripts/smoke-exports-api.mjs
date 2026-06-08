#!/usr/bin/env node
import JSZip from "jszip";

const baseUrl = (process.env.API_BASE_URL || "http://localhost:3107").replace(/\/$/, "");
const adminPassword = process.env.ADMIN_PASSWORD || "shazam!";
const expectedRelativePathPrefix = process.env.EXPECT_ATTACHMENT_RELATIVE_PATH_PREFIX || "";
const useDirectUpload = process.env.SMOKE_DIRECT_ATTACHMENT_UPLOAD === "1";

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
      console.warn(`Cleanup failed for ${sessionId}: ${error.message}`);
    }
  }
}

function textDataUrl(text) {
  return `data:text/plain;base64,${Buffer.from(text, "utf8").toString("base64")}`;
}

async function uploadAttachment(sessionId, name, mimeType, text) {
  if (!useDirectUpload) {
    const uploaded = await request(`/api/sessions/${sessionId}/attachments`, {
      method: "POST",
      body: JSON.stringify({ name, mimeType, dataUrl: textDataUrl(text) }),
    });
    return uploaded.attachment;
  }

  const target = await request(`/api/sessions/${sessionId}/attachments/upload-target`, {
    method: "POST",
    body: JSON.stringify({ name, mimeType }),
  });
  assert(typeof target.uploadUrl === "string" && target.uploadUrl.length > 0, "Direct upload target did not return uploadUrl");

  const uploadResponse = await fetch(target.uploadUrl, {
    method: "POST",
    headers: { "Content-Type": mimeType },
    body: text,
  });
  const uploadData = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok) {
    throw new Error(`Direct storage upload failed (${uploadResponse.status})`);
  }
  assert(typeof uploadData.storageId === "string" && uploadData.storageId.length > 0, "Direct upload did not return storageId");

  const finalized = await request(`/api/sessions/${sessionId}/attachments/finalize-upload`, {
    method: "POST",
    body: JSON.stringify({ name, mimeType, storageId: uploadData.storageId }),
  });
  return finalized.attachment;
}

async function fetchExport(sessionId, kind) {
  const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/export/${kind}`);
  if (!response.ok) {
    throw new Error(`GET /export/${kind} failed (${response.status}): ${await response.text()}`);
  }
  return response;
}

async function assertDocxExport(sessionId, kind, label, expectedText = []) {
  const response = await fetchExport(sessionId, kind);
  assert(
    response.headers.get("content-type")?.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    `${label} content type changed`
  );
  const contentDisposition = response.headers.get("content-disposition") || "";
  assert(contentDisposition.includes(".docx"), `${label} content disposition did not include a DOCX filename`);
  if (kind === "docx") {
    assert(contentDisposition.includes("-canvas.docx"), "DOCX export filename no longer uses the canvas suffix");
  }
  if (kind === "overview-docx") {
    assert(contentDisposition.includes("-overview.docx"), "Overview DOCX export filename no longer uses the overview suffix");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  assert(buffer.length > 1000, `${label} was unexpectedly small`);
  assert(buffer.subarray(0, 2).toString("utf8") === "PK", `${label} did not return an Office ZIP payload`);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  assert(documentXml, `${label} did not include word/document.xml`);
  for (const text of expectedText) {
    assert(documentXml.includes(text), `${label} missing expected document text: ${text}`);
  }
}

async function main() {
  console.log(`Running exports API smoke against ${baseUrl}`);

  const login = await request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password: adminPassword }),
  });
  assert(typeof login.sessionId === "string" && login.sessionId.length > 0, "Admin login did not return sessionId");
  adminSessionId = login.sessionId;

  const uniquePhrase = `export-provider-smoke-${Date.now()}`;
  const create = await request("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      name: `Export smoke ${Date.now()}`,
      require_password: false,
      project_client: "Export Smoke Client",
      project_background: `Export smoke background ${uniquePhrase}`,
      project_notes: `Export smoke notes ${uniquePhrase}`,
    }),
  });
  const sessionId = create.session?.id;
  assert(typeof sessionId === "string" && sessionId.length > 0, "Create session did not return session.id");
  createdSessionIds.push(sessionId);

  const cardA = await request(`/api/sessions/${sessionId}/cards`, {
    method: "POST",
    body: JSON.stringify({ section: "place", content: `Setting card ${uniquePhrase}`, starred: true }),
  });
  const cardB = await request(`/api/sessions/${sessionId}/cards`, {
    method: "POST",
    body: JSON.stringify({ section: "role", content: `Role card ${uniquePhrase}` }),
  });
  const cardAId = cardA.card?.id;
  const cardBId = cardB.card?.id;
  assert(cardAId && cardBId, "Card creation did not return IDs");

  const connection = await request(`/api/sessions/${sessionId}/connections`, {
    method: "POST",
    body: JSON.stringify({
      from: cardAId,
      to: cardBId,
      threadId: "thread-export",
      color: "red",
      ownerUserId: "export-smoke-user",
    }),
  });
  assert(connection.connection?.id, "Connection creation did not return ID");

  const note = await request(`/api/sessions/${sessionId}/notes`, {
    method: "POST",
    body: JSON.stringify({
      id: "session-notes",
      title: "Notes",
      content: `Export smoke note ${uniquePhrase}`,
    }),
  });
  assert(note.note?.id === "session-notes", "Note create did not preserve note ID");

  const attachment = await uploadAttachment(
    sessionId,
    "export-source.txt",
    "text/plain",
    `Export smoke attachment ${uniquePhrase}`
  );
  assert(attachment?.id, "Attachment upload did not return ID");
  if (expectedRelativePathPrefix) {
    assert(
      attachment.relativePath.startsWith(expectedRelativePathPrefix),
      `Attachment relativePath did not start with ${expectedRelativePathPrefix}`
    );
  }

  const markdownResponse = await fetchExport(sessionId, "markdown");
  assert(markdownResponse.headers.get("content-type")?.includes("text/markdown"), "Markdown export content type changed");
  const markdown = await markdownResponse.text();
  assert(markdown.includes(`Setting card ${uniquePhrase}`), "Markdown export missing card content");
  assert(markdown.includes(`Export smoke note ${uniquePhrase}`), "Markdown export missing note content");

  const jsonResponse = await fetchExport(sessionId, "json");
  assert(jsonResponse.headers.get("content-type")?.includes("application/json"), "JSON export content type changed");
  const exportData = await jsonResponse.json();
  assert(exportData.session?.id === sessionId, "JSON export missing session");
  assert(exportData.cards?.some((card) => card.id === cardAId), "JSON export missing cards");
  assert(exportData.connections?.some((item) => item.id === connection.connection.id), "JSON export missing connection");
  assert(exportData.notes?.some((item) => item.id === "session-notes"), "JSON export missing notes");

  await assertDocxExport(sessionId, "docx", "DOCX export", [
    `Setting card ${uniquePhrase}`,
    `Export smoke note ${uniquePhrase}`,
  ]);
  await assertDocxExport(sessionId, "overview-docx", "Overview DOCX export", [
    "Project Overview",
    "Export Smoke Client",
    `Export smoke background ${uniquePhrase}`,
    "Additional Notes",
    `Export smoke notes ${uniquePhrase}`,
  ]);

  const zipResponse = await fetchExport(sessionId, "zip");
  const zip = await JSZip.loadAsync(Buffer.from(await zipResponse.arrayBuffer()));
  const root = `${sessionId}/`;
  assert(zip.file(`${root}session.json`), "ZIP export missing session.json");
  assert(zip.file(`${root}attachments.json`), "ZIP export missing attachments.json");

  await request(`/api/sessions/${sessionId}`, { method: "DELETE" });
  createdSessionIds.pop();

  console.log("Exports API smoke passed");
}

main().catch(async (error) => {
  console.error(error);
  await cleanup();
  process.exitCode = 1;
});
