#!/usr/bin/env node

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
      body: JSON.stringify({
        name,
        mimeType,
        dataUrl: textDataUrl(text),
      }),
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

async function main() {
  console.log(`Running upload brief smoke against ${baseUrl}`);

  const login = await request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password: adminPassword }),
  });
  assert(typeof login.sessionId === "string" && login.sessionId.length > 0, "Admin login did not return sessionId");
  adminSessionId = login.sessionId;

  const uniquePhrase = `brief-provider-smoke-${Date.now()}`;
  const uploadedText = [
    `Client Alpha needs the ${uniquePhrase} operating model for regional launch planning.`,
    "The audience is a field leadership team that needs clearer rollout decisions.",
    "Success means fewer handoff gaps and faster escalation of launch risks.",
  ].join("\n");

  const create = await request("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      name: `Brief upload smoke ${Date.now()}`,
      require_password: false,
    }),
  });
  const sessionId = create.session?.id;
  assert(typeof sessionId === "string" && sessionId.length > 0, "Create session did not return session.id");
  createdSessionIds.push(sessionId);

  const attachment = await uploadAttachment(sessionId, "brief-source.txt", "text/plain", uploadedText);
  assert(attachment?.id, "Upload did not return attachment.id");

  await request(`/api/sessions/${sessionId}/attachments/${attachment.id}`, {
    method: "PATCH",
    body: JSON.stringify({ note: `Facilitator note must mention ${uniquePhrase}.` }),
  });

  const listed = await request(`/api/sessions/${sessionId}/attachments`);
  const listedAttachment = listed.attachments.find((item) => item.id === attachment.id);
  assert(listedAttachment, "Attachment list did not include uploaded attachment");
  assert(
    typeof listedAttachment.relativePath === "string" && listedAttachment.relativePath.length > 0,
    "Listed attachment did not include relativePath"
  );
  if (expectedRelativePathPrefix) {
    assert(
      listedAttachment.relativePath.startsWith(expectedRelativePathPrefix),
      `Attachment relativePath did not start with ${expectedRelativePathPrefix}`
    );
  }
  assert(
    listedAttachment.extractedText.includes(uniquePhrase),
    "Listed attachment extractedText did not include uploaded source content"
  );
  assert(
    listedAttachment.note.includes(uniquePhrase),
    "Listed attachment note did not preserve source note for brief generation"
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    assert(String(url).endsWith("/api/ai/complete"), "Brief generator did not call the AI completion API");
    const body = JSON.parse(String(options.body || "{}"));
    assert(body.prompt.includes(uniquePhrase), "Brief generation prompt did not include uploaded attachment content");
    assert(body.prompt.includes("Facilitator note"), "Brief generation prompt did not include attachment note");
    return new Response(JSON.stringify({ text: `Generated brief using ${uniquePhrase}.` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const { generateBriefFromUploads } = await import("../src/services/ai.ts");
    const brief = await generateBriefFromUploads(
      "Client Alpha",
      "Existing overview baseline.",
      "Existing project notes.",
      [listedAttachment],
      "gemini-2.5-flash"
    );
    assert(brief.includes(uniquePhrase), "Brief generator did not return mocked AI output");
  } finally {
    globalThis.fetch = originalFetch;
  }

  await request(`/api/sessions/${sessionId}`, { method: "DELETE" });
  createdSessionIds.pop();

  console.log("Upload brief smoke passed");
}

main().catch(async (error) => {
  console.error(error);
  await cleanup();
  process.exitCode = 1;
});
