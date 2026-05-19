import express from "express";
import { createServer as createViteServer } from "vite";
import { Type } from "@google/genai";
import dotenv from "dotenv";
import { generateText, getAiConfig } from "./src/server/ai";
import { extractAttachmentContent, type ProjectAttachment } from "./src/server/documents";
import { getCurrentBackend } from "./src/server/backend/current";
import type { AdminSession } from "./src/server/backend/types";
import { serializeCardFile, type CardFrontmatter } from "./src/server/files";
import archiver from "archiver";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const PARTYKIT_HOST = process.env.PARTYKIT_HOST || "localhost:1999";

function getAllowedOrigins() {
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaults = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];

  return new Set([...defaults, ...configuredOrigins]);
}

function normalizePdfText(text: string): string {
  return text
    .replace(/→/g, "->")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}

function escapePdfText(text: string): string {
  return normalizePdfText(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapPdfLine(line: string, maxLength = 90): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  return current ? [...lines, current] : [""];
}

function createSimplePdfBuffer(title: string, markdown: string): Buffer {
  const plainText = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^- /gm, "* ")
    .trim();
  const lines = plainText
    .split(/\r?\n/)
    .flatMap((line) => wrapPdfLine(line.trim()));
  const pages: string[][] = [];
  const linesPerPage = 46;

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  if (pages.length === 0) {
    pages.push([title]);
  }

  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];

  for (const pageLines of pages) {
    const content = [
      "BT",
      "/F1 11 Tf",
      "50 760 Td",
      "14 TL",
      ...pageLines.map((line, index) => `${index === 0 ? "" : "T* " }(${escapePdfText(line)}) Tj`),
      "ET",
    ].join("\n");
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[catalogId - 1] = "<< /Type /Catalog /Pages 2 0 R >>";

  const chunks: string[] = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  let length = Buffer.byteLength(chunks[0], "binary");

  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`;
    chunks.push(chunk);
    length += Buffer.byteLength(chunk, "binary");
  });

  const xrefOffset = length;
  const xref = [
    `xref\n0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n");

  return Buffer.from([...chunks, xref].join(""), "binary");
}

async function startServer() {
  const { adminAuth, sessions, cards, connections, sessionFiles, attachments } = getCurrentBackend();
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const distDir = path.join(process.cwd(), "dist");
  const allowedOrigins = getAllowedOrigins();

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
    }

    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, x-admin-session, x-session-password");

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    next();
  });

  app.use(express.json({ limit: "100mb" }));
  
  // Cleanup expired admin sessions periodically
  setInterval(() => {
    adminAuth.cleanupExpiredSessions();
  }, 60 * 60 * 1000); // Every hour

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/ai/config", (req, res) => {
    res.json(getAiConfig());
  });

  app.post("/api/ai/complete", async (req, res) => {
    try {
      const { prompt, model, responseFormat } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const text = await generateText({
        prompt,
        model: model || getAiConfig().defaultModel,
        ...(responseFormat === "json"
          ? {
              responseMimeType: "application/json" as const,
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    section: {
                      type: Type.STRING,
                      description: "Must be one of: place, role, challenge, point_a, point_b, change",
                    },
                    content: {
                      type: Type.STRING,
                      description: "The idea content.",
                    },
                  },
                  required: ["section", "content"],
                },
              },
            }
          : {}),
      });

      res.json({ text });
    } catch (error: any) {
      console.error("AI completion error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { systemInstruction, history, message, model } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const text = await generateText({
        model: model || getAiConfig().defaultModel,
        systemInstruction,
        history: Array.isArray(history)
          ? history.map((entry) => ({
              role: entry.role,
              text: entry.parts?.[0]?.text || "",
            }))
          : [],
        message,
      });

      res.json({ text });
    } catch (error: any) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // ============ ADMIN AUTHENTICATION API ============
  
  // Admin login
  app.post("/api/admin/login", (req, res) => {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }
      
      if (!adminAuth.verifyAdminPassword(password)) {
        return res.status(401).json({ error: "Invalid password" });
      }
      
      const session = adminAuth.createAdminSession();
      
      res.json({
        sessionId: session.id,
        expiresAt: session.expires_at
      });
    } catch (error: any) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin logout
  app.post("/api/admin/logout", (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (sessionId) {
        adminAuth.deleteAdminSession(sessionId);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Admin logout error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check admin authentication
  app.get("/api/admin/check", (req, res) => {
    try {
      const isAuthenticated = adminAuth.isAdminAuthenticated(req);
      res.json({ isAuthenticated });
    } catch (error: any) {
      console.error("Admin check error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/partykit-token", adminAuth.requireAdminAuth, (req, res) => {
    try {
      const session = (req as any).adminSession as AdminSession;
      const token = adminAuth.createPartyKitAdminToken(session.id);
      res.json({ token, partykitHost: PARTYKIT_HOST });
    } catch (error: any) {
      console.error("Admin PartyKit token error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper middleware to check edit permissions (admin or session password)
  async function requireEditPermission(req: any, res: any, next: any) {
    try {
      const { id: sessionId } = req.params;
      const headerPassword = Array.isArray(req.headers["x-session-password"])
        ? req.headers["x-session-password"][0]
        : req.headers["x-session-password"];
      const { edit_password } = req.body || {};
      const editPassword = edit_password || headerPassword;
      
      // Check if admin is authenticated
      if (adminAuth.isAdminAuthenticated(req)) {
        return next();
      }
      
      // Get session
      const session = await sessions.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Check if session is open (no password)
      if (!session.password_hash) {
        return next();
      }
      
      // Check if password was provided
      if (editPassword && await sessions.verifySessionPassword(sessionId, editPassword)) {
        return next();
      }
      
      // Deny access
      res.status(403).json({ error: "Edit permission required. Provide edit_password or login as admin." });
    } catch (error: any) {
      console.error("Edit permission error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  }

  // ============ SESSION MANAGEMENT API ============
  
  // List all sessions (Admin only)
  app.get("/api/sessions", adminAuth.requireAdminAuth, async (req, res) => {
    try {
      const allSessions = await sessions.getAllSessions();
      // Remove password_hash from response
      const safeSessions = allSessions.map(s => ({
        id: s.id,
        name: s.name,
        created_at: s.created_at,
        updated_at: s.updated_at,
        project_client: s.project_client,
        project_background: s.project_background,
        project_notes: s.project_notes,
        onboarding_completed: s.onboarding_completed,
        has_password: !!s.password_hash,
        is_archived: s.is_archived
      }));
      res.json({ sessions: safeSessions });
    } catch (error: any) {
      console.error("Error listing sessions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create new session (Admin only)
  app.post("/api/sessions", adminAuth.requireAdminAuth, async (req, res) => {
    try {
      const { name, require_password, project_client, project_background, project_notes } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Session name is required" });
      }
      
      const id = sessions.generateSessionId();
      
      const result = await sessions.createSession(id, name, {
        requirePassword: require_password === true,
        projectClient: project_client || "",
        projectBackground: project_background || "",
        projectNotes: project_notes || ""
      });
      
      // Write initial session metadata to file
      sessionFiles.writeSessionMetadata(id, {
        id,
        name,
        projectClient: project_client || "",
        projectBackground: project_background || "",
        projectNotes: project_notes || "",
        createdAt: result.session.created_at,
        updatedAt: result.session.updated_at
      });
      
      res.status(201).json({
        session: {
          id: result.session.id,
          name: result.session.name,
          password: result.password, // Return password if one was generated
          has_password: !!result.session.password_hash,
          created_at: result.session.created_at,
          project_client: result.session.project_client,
          project_background: result.session.project_background,
          project_notes: result.session.project_notes,
          onboarding_completed: result.session.onboarding_completed
        }
      });
    } catch (error: any) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single session
  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const session = await sessions.getSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Get cards for this session
      const sessionCards = await cards.getCardsBySession(id);
      
      // Get connections for this session
      const sessionConnections = await connections.getConnectionsBySession(id);
      const simplifiedConnections = sessionConnections.map(c => ({
        id: c.id,
        from: c.from_card_id,
        to: c.to_card_id,
        threadId: c.thread_id || undefined,
        color: c.color || undefined,
        ownerUserId: c.owner_user_id || undefined
      }));
      
      res.json({
        session: {
          id: session.id,
          name: session.name,
          created_at: session.created_at,
          updated_at: session.updated_at,
          project_client: session.project_client,
          project_background: session.project_background,
          project_notes: session.project_notes,
          onboarding_completed: session.onboarding_completed,
          has_password: !!session.password_hash
        },
        cards: sessionCards,
        connections: simplifiedConnections
      });
    } catch (error: any) {
      console.error("Error getting session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Complete onboarding (Admin only)
  app.post("/api/sessions/:id/complete-onboarding", adminAuth.requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const session = await sessions.getSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const success = await sessions.completeOnboarding(id);
      
      res.json({ success, onboarding_completed: true });
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update session metadata
  app.put("/api/sessions/:id", requireEditPermission, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, project_client, project_background, project_notes } = req.body;
      
      const session = await sessions.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (project_client !== undefined) updates.project_client = project_client;
      if (project_background !== undefined) updates.project_background = project_background;
      if (project_notes !== undefined) updates.project_notes = project_notes;
      
      const success = await sessions.updateSession(id, updates);
      
      if (success) {
        // Update metadata file
        sessionFiles.writeSessionMetadata(id, {
          id,
          name: name || session.name,
          projectClient: project_client ?? session.project_client,
          projectBackground: project_background ?? session.project_background,
          projectNotes: project_notes ?? session.project_notes,
          createdAt: session.created_at,
          updatedAt: new Date().toISOString()
        });
      }
      
      res.json({ success });
    } catch (error: any) {
      console.error("Error updating session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sessions/:id/attachments", requireEditPermission, async (req, res) => {
    try {
      const { id } = req.params;
      const session = await sessions.getSession(id);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const sessionAttachments = await attachments.listAttachments<ProjectAttachment>(id);
      res.json({ attachments: sessionAttachments });
    } catch (error: any) {
      console.error("Error listing attachments:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sessions/:id/attachments", requireEditPermission, async (req, res) => {
    let cleanupAttachmentFile: (() => Promise<void> | void) | undefined;
    try {
      const { id } = req.params;
      const { name, mimeType, dataUrl } = req.body;
      const session = await sessions.getSession(id);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (!name || !dataUrl) {
        return res.status(400).json({ error: "Attachment name and dataUrl are required" });
      }

      const match = String(dataUrl).match(/^data:(.*?);base64,(.*)$/);
      if (!match) {
        return res.status(400).json({ error: "Invalid attachment payload" });
      }

      const [, detectedMimeType, base64Content] = match;
      const buffer = Buffer.from(base64Content, "base64");
      const saved = await attachments.writeAttachmentFile(
        id,
        name,
        buffer,
        mimeType || detectedMimeType || "application/octet-stream"
      );
      cleanupAttachmentFile = saved.cleanup;
      const extracted = await extractAttachmentContent(saved.fullPath);

      const attachment: ProjectAttachment = {
        id: `attachment-${Date.now()}`,
        name,
        mimeType: mimeType || detectedMimeType || "application/octet-stream",
        size: buffer.byteLength,
        uploadedAt: new Date().toISOString(),
        relativePath: saved.relativePath,
        extractionStatus: extracted.extractionStatus,
        extractedText: extracted.extractedText,
        summary: extracted.summary,
        note: "",
      };

      await attachments.saveAttachment(id, attachment);

      res.status(201).json({ attachment });
    } catch (error: any) {
      console.error("Error uploading attachment:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await cleanupAttachmentFile?.();
    }
  });

  app.patch("/api/sessions/:id/attachments/:attachmentId", requireEditPermission, async (req, res) => {
    try {
      const { id, attachmentId } = req.params;
      const { name, note } = req.body;
      const session = await sessions.getSession(id);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const attachment = await attachments.updateAttachment<ProjectAttachment>(
        id,
        attachmentId,
        (current) => ({
          ...current,
          name: typeof name === "string" && name.trim() ? name.trim() : current.name,
          note: typeof note === "string" ? note : current.note || "",
        })
      );

      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      res.json({ attachment });
    } catch (error: any) {
      console.error("Error updating attachment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/sessions/:id/attachments/:attachmentId", requireEditPermission, async (req, res) => {
    try {
      const { id, attachmentId } = req.params;
      const session = await sessions.getSession(id);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const attachment = await attachments.deleteAttachment<ProjectAttachment>(id, attachmentId);
      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting attachment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete session (Admin only)
  app.delete("/api/sessions/:id", adminAuth.requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const session = await sessions.getSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Delete from database (cascade will delete cards and connections)
      const success = await sessions.deleteSession(id);
      
      // Delete session directory
      if (success) {
        await attachments.deleteAllSessionAttachments(id);
        const sessionDir = sessionFiles.getSessionDir(id);
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        }
      }
      
      res.json({ success });
    } catch (error: any) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify session password
  app.post("/api/sessions/:id/verify", async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }
      
      const isValid = await sessions.verifySessionPassword(id, password);
      
      res.json({ valid: isValid });
    } catch (error: any) {
      console.error("Error verifying password:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CARDS API ============

  // Create new card (requires admin auth or session password)
  app.post("/api/sessions/:id/cards", requireEditPermission, async (req, res) => {
    try {
      const { id: sessionId } = req.params;
      const { section, content, order, starred } = req.body;
      
      if (!section) {
        return res.status(400).json({ error: "Section is required" });
      }
      
      const session = await sessions.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Generate card ID
      const cardId = `card-${Date.now()}`;
      const orderIndex = order ?? await cards.getNextOrderIndex(sessionId, section);
      
      const card = await cards.createCard(
        sessionId,
        cardId,
        section,
        content || "",
        orderIndex,
        starred || false
      );
      
      res.status(201).json({
        card: {
          ...card,
          content: content || "",
        }
      });
    } catch (error: any) {
      console.error("Error creating card:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update card (requires admin auth or session password)
  app.put("/api/sessions/:id/cards/:cardId", requireEditPermission, async (req, res) => {
    try {
      const { id: sessionId, cardId } = req.params;
      const { section, content, order, starred } = req.body;
      
      const session = await sessions.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const updates: any = {};
      if (section !== undefined) updates.section = section;
      if (order !== undefined) updates.order_index = order;
      if (starred !== undefined) updates.starred = starred;
      
      const success = await cards.updateCard(sessionId, cardId, updates, content);
      
      res.json({ success });
    } catch (error: any) {
      console.error("Error updating card:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete card (requires admin auth or session password)
  app.delete("/api/sessions/:id/cards/:cardId", requireEditPermission, async (req, res) => {
    try {
      const { id: sessionId, cardId } = req.params;
      
      // Delete connections involving this card
      await connections.deleteConnectionsForCard(cardId, sessionId);
      
      const success = await cards.deleteCard(sessionId, cardId);
      
      res.json({ success });
    } catch (error: any) {
      console.error("Error deleting card:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reorder cards (requires admin auth or session password)
  app.post("/api/sessions/:id/cards/reorder", requireEditPermission, async (req, res) => {
    try {
      const { id: sessionId } = req.params;
      const { section, card_ids } = req.body;
      
      if (!section || !card_ids || !Array.isArray(card_ids)) {
        return res.status(400).json({ error: "Section and card_ids array are required" });
      }
      
      const success = await cards.reorderCards(sessionId, section, card_ids);
      
      res.json({ success });
    } catch (error: any) {
      console.error("Error reordering cards:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CONNECTIONS API ============

  // Create connection (requires admin auth or session password)
  app.post("/api/sessions/:id/connections", requireEditPermission, async (req, res) => {
    try {
      const { id: sessionId } = req.params;
      const { from, to, threadId, color, ownerUserId } = req.body;
      
      if (!from || !to) {
        return res.status(400).json({ error: "Both 'from' and 'to' card IDs are required" });
      }
      
      const connection = await connections.createConnection(sessionId, from, to, threadId, color, ownerUserId);
      
      res.status(201).json({ connection: {
        id: connection.id,
        from: connection.from_card_id,
        to: connection.to_card_id,
        threadId: connection.thread_id || undefined,
        color: connection.color || undefined,
        ownerUserId: connection.owner_user_id || undefined
      }});
    } catch (error: any) {
      console.error("Error creating connection:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete connection (requires admin auth or session password)
  app.delete("/api/sessions/:id/connections/:connectionId", requireEditPermission, async (req, res) => {
    try {
      const { connectionId } = req.params;
      
      const success = await connections.deleteConnection(connectionId, req.params.id);
      
      res.json({ success });
    } catch (error: any) {
      console.error("Error deleting connection:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Save all connections (bulk update - requires admin auth or session password)
  app.post("/api/sessions/:id/connections/bulk", requireEditPermission, async (req, res) => {
    try {
      const { id: sessionId } = req.params;
      const { connections: newConnections } = req.body;
      
      if (!Array.isArray(newConnections)) {
        return res.status(400).json({ error: "Connections array is required" });
      }
      
      await connections.saveAllConnections(sessionId, newConnections);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error saving connections:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ EXPORT API ============

  const buildSessionMarkdown = async (id: string) => {
    const session = await sessions.getSession(id);
    if (!session) return null;

    const sessionCards = await cards.getCardsBySession(id);
    const sessionConnections = await connections.getConnectionsBySession(id);

    let markdown = `# Beyond Bullet Points: ${id}\n\n`;
    markdown += `## Session: ${session.name}\n\n`;
    markdown += `**Created:** ${new Date(session.created_at).toLocaleString()}\n\n`;

    if (session.project_client || session.project_background) {
      markdown += `## Project Context\n\n`;
      if (session.project_client) {
        markdown += `**Client:** ${session.project_client}\n\n`;
      }
      if (session.project_background) {
        markdown += `**Background:** ${session.project_background}\n\n`;
      }
      if (session.project_notes) {
        markdown += `**Notes:** ${session.project_notes}\n\n`;
      }
    }

    markdown += `## The Story\n\n`;

    const sectionOrder = ['place', 'role', 'challenge', 'point_a', 'point_b', 'change', 'story'];
    const sectionTitles: Record<string, string> = {
      place: 'Place: Your Setting',
      role: 'Role: Your Part',
      challenge: 'Challenge: The Obstacle',
      point_a: 'Point A: Where You Are',
      point_b: 'Point B: Where You Need to Be',
      change: 'Change: The Transformation',
      story: 'Story: The Journey'
    };

    for (const section of sectionOrder) {
      const sectionCards = sessionCards.filter(c => c.section === section);
      if (sectionCards.length > 0) {
        markdown += `### ${sectionTitles[section]}\n\n`;
        for (const card of sectionCards) {
          if (card.content) {
            markdown += `${card.content}\n\n`;
          }
        }
      }
    }

    if (sessionConnections.length > 0) {
      markdown += `## Connections\n\n`;
      markdown += `The following cards are connected to form a narrative flow:\n\n`;

      for (const conn of sessionConnections) {
        const fromCard = sessionCards.find(c => c.id === conn.from_card_id);
        const toCard = sessionCards.find(c => c.id === conn.to_card_id);
        if (fromCard && toCard) {
          markdown += `- **${fromCard.section}** -> **${toCard.section}**\n`;
        }
      }
      markdown += `\n`;
    }

    return { session, markdown };
  };

  // Export session as ZIP
  app.get("/api/sessions/:id/export/zip", async (req, res) => {
    try {
      const { id } = req.params;
      
      const session = await sessions.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const sessionCards = await cards.getCardsBySession(id);
      const sessionConnections = await connections.getConnectionsBySession(id);
      const sessionAttachments = await attachments.listAttachments<ProjectAttachment>(id);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${id}.zip"`);
      
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        res.status(500).json({ error: err.message });
      });
      
      archive.pipe(res);

      archive.append(
        JSON.stringify(
          {
            id: session.id,
            name: session.name,
            projectClient: session.project_client ?? "",
            projectBackground: session.project_background ?? "",
            projectNotes: session.project_notes ?? "",
            createdAt: session.created_at,
            updatedAt: session.updated_at,
          },
          null,
          2
        ),
        { name: `${id}/session.json` }
      );

      archive.append(JSON.stringify(sessionAttachments, null, 2), {
        name: `${id}/attachments.json`,
      });

      archive.append(
        JSON.stringify(
          sessionConnections.map((connection) => ({
            id: connection.id,
            from: connection.from_card_id,
            to: connection.to_card_id,
            threadId: connection.thread_id || undefined,
            color: connection.color || undefined,
            ownerUserId: connection.owner_user_id || undefined,
          })),
          null,
          2
        ),
        { name: `${id}/connections.json` }
      );

      for (const card of sessionCards) {
        const frontmatter: CardFrontmatter = {
          id: card.id,
          section: card.section,
          createdAt: card.created_at,
          updatedAt: card.updated_at,
          starred: card.starred,
          order: card.order_index,
        };

        archive.append(serializeCardFile(frontmatter, card.content), {
          name: `${id}/cards/${card.section}-${String(card.order_index).padStart(3, "0")}.md`,
        });
      }

      const skippedAttachmentNames: string[] = [];
      for (const attachment of sessionAttachments) {
        try {
          const fileBuffer = await attachments.readAttachmentFile(id, attachment.relativePath);
          archive.append(fileBuffer, {
            name: `${id}/attachments/${path.basename(attachment.relativePath)}`,
          });
        } catch (_error) {
          skippedAttachmentNames.push(attachment.name);
        }
      }

      if (skippedAttachmentNames.length > 0) {
        archive.append(
          [
            "Some uploaded source files are not included in this export.",
            "Reason: the current deployment is using temporary attachment storage.",
            "Persisted data still includes extracted text, summaries, and source notes in attachments.json.",
            "",
            "Skipped binaries:",
            ...skippedAttachmentNames.map((name) => `- ${name}`),
            "",
          ].join("\n"),
          { name: `${id}/attachments/README.txt` }
        );
      }

      archive.finalize();
    } catch (error: any) {
      console.error("Error exporting ZIP:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Export session as consolidated Markdown
  app.get("/api/sessions/:id/export/markdown", async (req, res) => {
    try {
      const { id } = req.params;

      const exportContent = await buildSessionMarkdown(id);
      if (!exportContent) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${id}.md"`);
      res.send(exportContent.markdown);
    } catch (error: any) {
      console.error("Error exporting markdown:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Export session as PDF
  app.get("/api/sessions/:id/export/pdf", async (req, res) => {
    try {
      const { id } = req.params;

      const exportContent = await buildSessionMarkdown(id);
      if (!exportContent) {
        return res.status(404).json({ error: "Session not found" });
      }

      const pdf = createSimplePdfBuffer(exportContent.session.name || id, exportContent.markdown);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${id}.pdf"`);
      res.send(pdf);
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Export session as JSON
  app.get("/api/sessions/:id/export/json", async (req, res) => {
    try {
      const { id } = req.params;
      
      const session = await sessions.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const sessionCards = await cards.getCardsBySession(id);
      const sessionConnections = await connections.getConnectionsBySession(id);
      
      const exportData = {
        session: {
          id: session.id,
          name: session.name,
          created_at: session.created_at,
          updated_at: session.updated_at,
          project_client: session.project_client,
          project_background: session.project_background,
          project_notes: session.project_notes
        },
        cards: sessionCards.map(c => ({
          id: c.id,
          section: c.section,
          content: c.content,
          order: c.order_index,
          starred: c.starred,
          created_at: c.created_at,
          updated_at: c.updated_at
        })),
        connections: sessionConnections.map(c => ({
          id: c.id,
          from: c.from_card_id,
          to: c.to_card_id,
          threadId: c.thread_id || undefined,
          color: c.color || undefined,
          ownerUserId: c.owner_user_id || undefined
        }))
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${id}.json"`);
      res.json(exportData);
    } catch (error: any) {
      console.error("Error exporting JSON:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/data/**', '**/*.db', '**/*.db-wal', '**/*.db-shm', '**/*.db-journal'],
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`📁 Session data stored in: ${path.join(process.cwd(), 'data')}`);
  });
}

startServer();
