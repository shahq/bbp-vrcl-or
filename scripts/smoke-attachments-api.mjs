#!/usr/bin/env node
import JSZip from "jszip";

const baseUrl = (process.env.API_BASE_URL || "http://localhost:3107").replace(/\/$/, "");
const adminPassword = process.env.ADMIN_PASSWORD || "shazam!";
const expectedRelativePathPrefix = process.env.EXPECT_ATTACHMENT_RELATIVE_PATH_PREFIX || "";
const smokeDirectUpload = process.env.SMOKE_DIRECT_ATTACHMENT_UPLOAD === "1";
const smokeArchiveRoundtrip = process.env.SMOKE_ATTACHMENT_ARCHIVE_ROUNDTRIP === "1";
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
      console.warn(`Cleanup failed for ${sessionId}: ${error.message}`);
    }
  }
}

function textDataUrl(text) {
  return `data:text/plain;base64,${Buffer.from(text, "utf8").toString("base64")}`;
}

function zipDataUrl(buffer) {
  return `data:application/zip;base64,${Buffer.from(buffer).toString("base64")}`;
}

function assertAttachmentShape(attachment, expectedName) {
  assert(attachment?.id, "Upload did not return attachment.id");
  assert(attachment.name === expectedName, "Upload did not preserve attachment name");
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
}

async function assertAttachmentListed(sessionId, attachmentId) {
  const listed = await request(`/api/sessions/${sessionId}/attachments`);
  assert(
    listed.attachments.some((item) => item.id === attachmentId),
    "Attachment list did not include uploaded attachment"
  );
}

async function smokeArchiveRoundtripForSession(sessionId, attachmentId) {
  await request(`/api/sessions/${sessionId}/cards`, {
    method: "POST",
    body: JSON.stringify({
      section: "place",
      content: "Archive roundtrip smoke card.",
      starred: false,
    }),
  });

  const exportResponse = await fetch(`${baseUrl}/api/sessions/${sessionId}/export/zip`, {
    headers: {
      ...(smokeRequestCookie ? { Cookie: smokeRequestCookie } : {}),
    },
  });
  if (!exportResponse.ok) {
    throw new Error(`ZIP export failed (${exportResponse.status}): ${await exportResponse.text()}`);
  }

  const exportedBuffer = Buffer.from(await exportResponse.arrayBuffer());
  const zip = await JSZip.loadAsync(exportedBuffer);
  const fileNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  const root = `${sessionId}/`;

  assert(fileNames.includes(`${root}session.json`), "ZIP export missing session.json");
  assert(fileNames.some((name) => name.startsWith(`${root}cards/`) && name.endsWith(".md")), "ZIP export missing card markdown");
  assert(fileNames.includes(`${root}connections.json`), "ZIP export missing connections.json");
  assert(fileNames.includes(`${root}attachments.json`), "ZIP export missing attachments.json");
  assert(fileNames.includes(`${root}notes.json`), "ZIP export missing notes.json");
  assert(fileNames.some((name) => name.startsWith(`${root}attachments/`)), "ZIP export missing attachment binary");

  const attachments = JSON.parse(await zip.file(`${root}attachments.json`).async("string"));
  assert(
    attachments.some((attachment) => attachment.id === attachmentId),
    "ZIP export attachments.json missing uploaded attachment"
  );

  const imported = await request(`/api/sessions/${sessionId}/import/zip`, {
    method: "POST",
    body: JSON.stringify({
      name: "roundtrip.zip",
      dataUrl: zipDataUrl(exportedBuffer),
    }),
  });

  assert(
    imported.attachments.some((attachment) => attachment.id === attachmentId),
    "ZIP import did not restore uploaded attachment metadata"
  );
  const restored = await request(`/api/sessions/${sessionId}/attachments`);
  assert(
    restored.attachments.some((attachment) => attachment.id === attachmentId),
    "Attachment list did not include ZIP-restored attachment"
  );
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
      dataUrl: textDataUrl("Source text attachment smoke verification."),
    }),
  });
  const attachment = upload.attachment;
  assertAttachmentShape(attachment, "source-notes.txt");
  await assertAttachmentListed(sessionId, attachment.id);

  if (smokeDirectUpload) {
    const directText = "Source text uploaded directly through Convex storage.";
    const target = await request(`/api/sessions/${sessionId}/attachments/upload-target`, {
      method: "POST",
      body: JSON.stringify({
        name: "direct-source.txt",
        mimeType: "text/plain",
      }),
    });
    assert(typeof target.uploadUrl === "string" && target.uploadUrl.length > 0, "Direct upload target did not return uploadUrl");

    const uploadResponse = await fetch(target.uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: directText,
    });
    const uploadData = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) {
      throw new Error(`Direct storage upload failed (${uploadResponse.status})`);
    }
    assert(typeof uploadData.storageId === "string" && uploadData.storageId.length > 0, "Direct upload did not return storageId");

    const finalized = await request(`/api/sessions/${sessionId}/attachments/finalize-upload`, {
      method: "POST",
      body: JSON.stringify({
        name: "direct-source.txt",
        mimeType: "text/plain",
        storageId: uploadData.storageId,
      }),
    });
    const directAttachment = finalized.attachment;
    assertAttachmentShape(directAttachment, "direct-source.txt");
    await assertAttachmentListed(sessionId, directAttachment.id);

    const directDeleted = await request(`/api/sessions/${sessionId}/attachments/${directAttachment.id}`, {
      method: "DELETE",
    });
    assert(directDeleted.success === true, "Direct attachment delete did not return success");
  }

  if (smokeArchiveRoundtrip) {
    await smokeArchiveRoundtripForSession(sessionId, attachment.id);
  }

  const renamed = await request(`/api/sessions/${sessionId}/attachments/${attachment.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: "renamed-source.txt",
      note: "Use this source in brief.",
    }),
  });
  assert(renamed.attachment?.name === "renamed-source.txt", "Attachment rename did not persist");
  assert(renamed.attachment?.note === "Use this source in brief.", "Attachment note did not persist");

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
      dataUrl: textDataUrl("Attachment session-delete cleanup verification."),
    }),
  });
  assert(cleanupUpload.attachment?.id, "Cleanup upload did not return attachment");

  await request(`/api/sessions/${sessionId}`, { method: "DELETE" });
  createdSessionIds.pop();

  console.log("Attachments API smoke passed");
}

main().catch(async (error) => {
  console.error(error);
  await cleanup();
  process.exitCode = 1;
});
