import express from "express";
import { createServer as createViteServer } from "vite";
import { Type } from "@google/genai";
import dotenv from "dotenv";
import * as sessions from "./src/server/sessions";
import * as cards from "./src/server/cards";
import * as connections from "./src/server/connections";
import * as fileUtils from "./src/server/files";
import * as admin from "./src/server/admin";
import { generateText, getAiConfig } from "./src/server/ai";
import { extractAttachmentContent, type ProjectAttachment } from "./src/server/documents";
import archiver from "archiver";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const PARTYKIT_HOST = process.env.PARTYKIT_HOST || "localhost:1999";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const distDir = path.join(process.cwd(), "dist");

  app.use(express.json({ limit: "100mb" }));
  
  // Cleanup expired admin sessions periodically
  setInterval(() => {
    admin.cleanupExpiredSessions();
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
      
      if (!admin.verifyAdminPassword(password)) {
        return res.status(401).json({ error: "Invalid password" });
      }
      
      const session = admin.createAdminSession();
      
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
        admin.deleteAdminSession(sessionId);
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
      const isAuthenticated = admin.isAdminAuthenticated(req);
      res.json({ isAuthenticated });
    } catch (error: any) {
      console.error("Admin check error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/partykit-token", admin.requireAdminAuth, (req, res) => {
    try {
      const session = (req as any).adminSession as admin.AdminSession;
      const token = admin.createPartyKitAdminToken(session.id);
      res.json({ token, partykitHost: PARTYKIT_HOST });
    } catch (error: any) {
      console.error("Admin PartyKit token error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper middleware to check edit permissions (admin or session password)
  function requireEditPermission(req: any, res: any, next: any) {
    const { id: sessionId } = req.params;
    const { edit_password } = req.body;
    
    // Check if admin is authenticated
    if (admin.isAdminAuthenticated(req)) {
      return next();
    }
    
    // Get session
    const session = sessions.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    // Check if session is open (no password)
    if (!session.password_hash) {
      return next();
    }
    
    // Check if password was provided
    if (edit_password && sessions.verifySessionPassword(sessionId, edit_password)) {
      return next();
    }
    
    // Deny access
    res.status(403).json({ error: "Edit permission required. Provide edit_password or login as admin." });
  }

  // ============ SESSION MANAGEMENT API ============
  
  // List all sessions (Admin only)
  app.get("/api/sessions", admin.requireAdminAuth, (req, res) => {
    try {
      const allSessions = sessions.getAllSessions();
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
  app.post("/api/sessions", admin.requireAdminAuth, (req, res) => {
    try {
      const { name, require_password, project_client, project_background, project_notes } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Session name is required" });
      }
      
      const id = sessions.generateSessionId();
      
      const result = sessions.createSession(id, name, {
        requirePassword: require_password === true,
        projectClient: project_client || "",
        projectBackground: project_background || "",
        projectNotes: project_notes || ""
      });
      
      // Write initial session metadata to file
      fileUtils.writeSessionMetadata(id, {
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
  app.get("/api/sessions/:id", (req, res) => {
    try {
      const { id } = req.params;
      const session = sessions.getSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Get cards for this session
      const sessionCards = cards.getCardsBySession(id);
      
      // Get connections for this session
      const sessionConnections = connections.getConnectionsBySession(id);
      const simplifiedConnections = sessionConnections.map(c => ({
        id: c.id,
        from: c.from_card_id,
        to: c.to_card_id
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
  app.post("/api/sessions/:id/complete-onboarding", admin.requireAdminAuth, (req, res) => {
    try {
      const { id } = req.params;
      const session = sessions.getSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const success = sessions.completeOnboarding(id);
      
      res.json({ success, onboarding_completed: true });
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update session metadata
  app.put("/api/sessions/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { name, project_client, project_background, project_notes } = req.body;
      
      const session = sessions.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (project_client !== undefined) updates.project_client = project_client;
      if (project_background !== undefined) updates.project_background = project_background;
      if (project_notes !== undefined) updates.project_notes = project_notes;
      
      const success = sessions.updateSession(id, updates);
      
      if (success) {
        // Update metadata file
        fileUtils.writeSessionMetadata(id, {
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

  app.get("/api/sessions/:id/attachments", admin.requireAdminAuth, (req, res) => {
    try {
      const { id } = req.params;
      const session = sessions.getSession(id);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const attachments = fileUtils.readAttachmentsIndex<ProjectAttachment>(id);
      res.json({ attachments });
    } catch (error: any) {
      console.error("Error listing attachments:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sessions/:id/attachments", admin.requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, mimeType, dataUrl } = req.body;
      const session = sessions.getSession(id);

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
      const saved = fileUtils.writeAttachmentFile(id, name, buffer);
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

      const attachments = fileUtils.readAttachmentsIndex<ProjectAttachment>(id);
      attachments.unshift(attachment);
      fileUtils.writeAttachmentsIndex(id, attachments);

      res.status(201).json({ attachment });
    } catch (error: any) {
      console.error("Error uploading attachment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/sessions/:id/attachments/:attachmentId", admin.requireAdminAuth, (req, res) => {
    try {
      const { id, attachmentId } = req.params;
      const { note } = req.body;
      const session = sessions.getSession(id);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const attachments = fileUtils.readAttachmentsIndex<ProjectAttachment>(id);
      const attachmentIndex = attachments.findIndex((item) => item.id === attachmentId);

      if (attachmentIndex === -1) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      attachments[attachmentIndex] = {
        ...attachments[attachmentIndex],
        note: typeof note === "string" ? note : attachments[attachmentIndex].note || "",
      };

      fileUtils.writeAttachmentsIndex(id, attachments);
      res.json({ attachment: attachments[attachmentIndex] });
    } catch (error: any) {
      console.error("Error updating attachment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/sessions/:id/attachments/:attachmentId", admin.requireAdminAuth, (req, res) => {
    try {
      const { id, attachmentId } = req.params;
      const session = sessions.getSession(id);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const attachments = fileUtils.readAttachmentsIndex<ProjectAttachment>(id);
      const attachment = attachments.find((item) => item.id === attachmentId);

      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      const fullPath = path.join(process.cwd(), attachment.relativePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      fileUtils.writeAttachmentsIndex(
        id,
        attachments.filter((item) => item.id !== attachmentId)
      );

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting attachment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete session (Admin only)
  app.delete("/api/sessions/:id", admin.requireAdminAuth, (req, res) => {
    try {
      const { id } = req.params;
      const session = sessions.getSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Delete from database (cascade will delete cards and connections)
      const success = sessions.deleteSession(id);
      
      // Delete session directory
      if (success) {
        const sessionDir = fileUtils.getSessionDir(id);
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
  app.post("/api/sessions/:id/verify", (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }
      
      const isValid = sessions.verifySessionPassword(id, password);
      
      res.json({ valid: isValid });
    } catch (error: any) {
      console.error("Error verifying password:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CARDS API ============

  // Create new card (requires admin auth or session password)
  app.post("/api/sessions/:id/cards", requireEditPermission, (req, res) => {
    try {
      const { id: sessionId } = req.params;
      const { section, content, order, starred } = req.body;
      
      if (!section) {
        return res.status(400).json({ error: "Section is required" });
      }
      
      const session = sessions.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Generate card ID
      const cardId = `card-${Date.now()}`;
      const orderIndex = order ?? cards.getNextOrderIndex(sessionId, section);
      
      const card = cards.createCard(
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
  app.put("/api/sessions/:id/cards/:cardId", requireEditPermission, (req, res) => {
    try {
      const { id: sessionId, cardId } = req.params;
      const { section, content, order, starred } = req.body;
      
      const session = sessions.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const updates: any = {};
      if (section !== undefined) updates.section = section;
      if (order !== undefined) updates.order_index = order;
      if (starred !== undefined) updates.starred = starred;
      
      const success = cards.updateCard(cardId, updates, content);
      
      res.json({ success });
    } catch (error: any) {
      console.error("Error updating card:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete card (requires admin auth or session password)
  app.delete("/api/sessions/:id/cards/:cardId", requireEditPermission, (req, res) => {
    try {
      const { id: sessionId, cardId } = req.params;
      
      // Delete connections involving this card
      connections.deleteConnectionsForCard(cardId);
      
      const success = cards.deleteCard(cardId);
      
      res.json({ success });
    } catch (error: any) {
      console.error("Error deleting card:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reorder cards (requires admin auth or session password)
  app.post("/api/sessions/:id/cards/reorder", requireEditPermission, (req, res) => {
    try {
      const { id: sessionId } = req.params;
      const { section, card_ids } = req.body;
      
      if (!section || !card_ids || !Array.isArray(card_ids)) {
        return res.status(400).json({ error: "Section and card_ids array are required" });
      }
      
      const success = cards.reorderCards(sessionId, section, card_ids);
      
      res.json({ success });
    } catch (error: any) {
      console.error("Error reordering cards:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CONNECTIONS API ============

  // Create connection (requires admin auth or session password)
  app.post("/api/sessions/:id/connections", requireEditPermission, (req, res) => {
    try {
      const { id: sessionId } = req.params;
      const { from, to } = req.body;
      
      if (!from || !to) {
        return res.status(400).json({ error: "Both 'from' and 'to' card IDs are required" });
      }
      
      const connection = connections.createConnection(sessionId, from, to);
      
      res.status(201).json({ connection: {
        id: connection.id,
        from: connection.from_card_id,
        to: connection.to_card_id
      }});
    } catch (error: any) {
      console.error("Error creating connection:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete connection (requires admin auth or session password)
  app.delete("/api/sessions/:id/connections/:connectionId", requireEditPermission, (req, res) => {
    try {
      const { connectionId } = req.params;
      
      const success = connections.deleteConnection(connectionId);
      
      res.json({ success });
    } catch (error: any) {
      console.error("Error deleting connection:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Save all connections (bulk update - requires admin auth or session password)
  app.post("/api/sessions/:id/connections/bulk", requireEditPermission, (req, res) => {
    try {
      const { id: sessionId } = req.params;
      const { connections: newConnections } = req.body;
      
      if (!Array.isArray(newConnections)) {
        return res.status(400).json({ error: "Connections array is required" });
      }
      
      connections.saveAllConnections(sessionId, newConnections);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error saving connections:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ EXPORT API ============

  // Export session as ZIP
  app.get("/api/sessions/:id/export/zip", async (req, res) => {
    try {
      const { id } = req.params;
      
      const session = sessions.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const sessionDir = fileUtils.getSessionDir(id);
      
      if (!fs.existsSync(sessionDir)) {
        return res.status(404).json({ error: "Session files not found" });
      }
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${id}.zip"`);
      
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        res.status(500).json({ error: err.message });
      });
      
      archive.pipe(res);
      archive.directory(sessionDir, id);
      archive.finalize();
    } catch (error: any) {
      console.error("Error exporting ZIP:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Export session as consolidated Markdown
  app.get("/api/sessions/:id/export/markdown", (req, res) => {
    try {
      const { id } = req.params;
      
      const session = sessions.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const sessionCards = cards.getCardsBySession(id);
      const sessionConnections = connections.getConnectionsBySession(id);
      
      // Build markdown content
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
      
      // Group cards by section
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
      
      // Add connections summary
      if (sessionConnections.length > 0) {
        markdown += `## Connections\n\n`;
        markdown += `The following cards are connected to form a narrative flow:\n\n`;
        
        for (const conn of sessionConnections) {
          const fromCard = sessionCards.find(c => c.id === conn.from_card_id);
          const toCard = sessionCards.find(c => c.id === conn.to_card_id);
          if (fromCard && toCard) {
            markdown += `- **${fromCard.section}** → **${toCard.section}**\n`;
          }
        }
        markdown += `\n`;
      }
      
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${id}.md"`);
      res.send(markdown);
    } catch (error: any) {
      console.error("Error exporting markdown:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Export session as JSON
  app.get("/api/sessions/:id/export/json", (req, res) => {
    try {
      const { id } = req.params;
      
      const session = sessions.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const sessionCards = cards.getCardsBySession(id);
      const sessionConnections = connections.getConnectionsBySession(id);
      
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
          to: c.to_card_id
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
