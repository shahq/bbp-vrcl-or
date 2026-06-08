#!/usr/bin/env node

const baseUrl = (process.env.API_BASE_URL || "http://localhost:3107").replace(/\/$/, "");
const adminPassword = process.env.ADMIN_PASSWORD || "shazam!";
const expectedRelativePathPrefix = process.env.EXPECT_ATTACHMENT_RELATIVE_PATH_PREFIX || "";

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
      console.warn(`Cleanup failed for ${sessionId}:`, error.message);
    }
  }
}

function textDataUrl(text) {
  return `data:text/plain;base64,${Buffer.from(text, "utf8").toString("base64")}`;
}

async function main() {
  console.log(`Running attachments API smoke against ${baseUrl}`);

  const login = await request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password: adminPassword }),
  });
  assert(typeof login.sessionId === "string" && login.sessionId.length > 0, "Admin login did not return sessionId");
  adminSessionId = login.sessionId;

  const create = await request("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      name: `Attachment smoke ${Date.now()}`,
      require_password: false,
    }),
  });
  const sessionId = create.session?.id;
  assert(typeof sessionId === "string" && sessionId.length > 0, "Create session did not return session.id");
  createdSessionIds.push(sessionId);

  const upload = await request(`/api/sessions/${sessionId}/attachments`, {
    method: "POST",
    body: JSON.stringify({
      name: "source-notes.txt",
      mimeType: "text/plain",
      dataUrl: textDataUrl("Source text for attachment provider smoke verification."),
    }),
  });
  const attachment = upload.attachment;
  assert(attachment?.id, "Upload did not return attachment.id");
  assert(attachment.name === "source-notes.txt", "Upload did not preserve attachment name");
  assert(attachment.mimeType === "text/plain", "Upload did not preserve attachment MIME type");
  assert(attachment.size > 0, "Upload did not report attachment size");
  assert(typeof attachment.relativePath === "string" && attachment.relativePath.length > 0, "Upload did not return relativePath");
  if (expectedRelativePathPrefix) {
    assert(
      attachment.relativePath.startsWith(expectedRelativePathPrefix),
      `Attachment relativePath did not start with ${expectedRelativePathPrefix}`
    );
  }
  assert(["ready", "unsupported", "error"].includes(attachment.extractionStatus), "Upload returned invalid extractionStatus");

  const listed = await request(`/api/sessions/${sessionId}/attachments`);
  assert(
    listed.attachments.some((item) => item.id === attachment.id),
    "Attachment list did not include uploaded attachment"
  );

  const renamed = await request(`/api/sessions/${sessionId}/attachments/${attachment.id}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "renamed-source.txt", note: "Use this in the brief." }),
  });
  assert(renamed.attachment?.name === "renamed-source.txt", "Attachment rename did not persist");
  assert(renamed.attachment?.note === "Use this in the brief.", "Attachment note did not persist");

  const deleted = await request(`/api/sessions/${sessionId}/attachments/${attachment.id}`, {
    method: "DELETE",
  });
  assert(deleted.success === true, "Attachment delete did not return success");

  const afterDelete = await request(`/api/sessions/${sessionId}/attachments`);
  assert(
    !afterDelete.attachments.some((item) => item.id === attachment.id),
    "Attachment list still included deleted attachment"
  );

  const cleanupUpload = await request(`/api/sessions/${sessionId}/attachments`, {
    method: "POST",
    body: JSON.stringify({
      name: "session-cleanup.txt",
      mimeType: "text/plain",
      dataUrl: textDataUrl("Attachment left for session-delete cleanup."),
    }),
  });
  assert(cleanupUpload.attachment?.id, "Cleanup upload did not return attachment.id");

  const deleteSession = await request(`/api/sessions/${sessionId}`, { method: "DELETE" });
  assert(deleteSession.success === true, "Session delete did not return success");
  createdSessionIds.pop();

  console.log("Attachments API smoke passed.");
}

main()
  .catch(async (error) => {
    console.error(error.message);
    await cleanup();
    process.exitCode = 1;
  });
