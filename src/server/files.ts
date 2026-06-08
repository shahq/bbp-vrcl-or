/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const DATA_DIR = path.join(process.cwd(), 'data');
const ATTACHMENTS_INDEX_FILE = 'attachments.json';

export interface CardFrontmatter {
  id: string;
  section: string;
  createdAt: string;
  updatedAt: string;
  starred: boolean;
  order: number;
}

export interface CardFile {
  frontmatter: CardFrontmatter;
  content: string;
}

export function serializeCardFile(frontmatter: CardFrontmatter, content: string): string {
  return `---
${yaml.dump(frontmatter)}---

${content}
`;
}

export function getSessionDir(sessionId: string): string {
  return path.join(DATA_DIR, 'sessions', sessionId);
}

export function ensureSessionDir(sessionId: string): void {
  const sessionDir = getSessionDir(sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  
  const cardsDir = path.join(sessionDir, 'cards');
  if (!fs.existsSync(cardsDir)) {
    fs.mkdirSync(cardsDir, { recursive: true });
  }

  const attachmentsDir = path.join(sessionDir, 'attachments');
  if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
  }
}

export function getAttachmentsDir(sessionId: string): string {
  ensureSessionDir(sessionId);
  return path.join(getSessionDir(sessionId), 'attachments');
}

export function writeAttachmentFile(
  sessionId: string,
  fileName: string,
  content: Buffer
): { relativePath: string; fullPath: string } {
  const attachmentsDir = getAttachmentsDir(sessionId);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueName = `${Date.now()}-${safeName}`;
  const fullPath = path.join(attachmentsDir, uniqueName);

  fs.writeFileSync(fullPath, content);

  return {
    relativePath: path.relative(process.cwd(), fullPath),
    fullPath,
  };
}

export function writeAttachmentArchiveFile(
  sessionId: string,
  fileName: string,
  content: Buffer
): { relativePath: string; fullPath: string } {
  const attachmentsDir = getAttachmentsDir(sessionId);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'attachment.bin';
  const fullPath = path.join(attachmentsDir, safeName);

  fs.writeFileSync(fullPath, content);

  return {
    relativePath: path.relative(process.cwd(), fullPath),
    fullPath,
  };
}

export function readAttachmentsIndex<T>(sessionId: string): T[] {
  const filePath = path.join(getSessionDir(sessionId), ATTACHMENTS_INDEX_FILE);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T[];
  } catch (error) {
    console.error('Error reading attachments index:', error);
    return [];
  }
}

export function writeAttachmentsIndex<T>(sessionId: string, attachments: T[]): void {
  ensureSessionDir(sessionId);
  const filePath = path.join(getSessionDir(sessionId), ATTACHMENTS_INDEX_FILE);
  fs.writeFileSync(filePath, JSON.stringify(attachments, null, 2), 'utf-8');
}

export function generateCardFilename(section: string, order: number): string {
  return `${section}-${String(order).padStart(3, '0')}.md`;
}

export function writeCardFile(
  sessionId: string,
  cardId: string,
  section: string,
  content: string,
  order: number = 0,
  starred: boolean = false,
  createdAt?: string
): string {
  ensureSessionDir(sessionId);
  
  const filename = generateCardFilename(section, order);
  const filePath = path.join(getSessionDir(sessionId), 'cards', filename);
  
  const frontmatter: CardFrontmatter = {
    id: cardId,
    section,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    starred,
    order
  };
  
  const fileContent = serializeCardFile(frontmatter, content);
  
  fs.writeFileSync(filePath, fileContent, 'utf-8');
  
  return path.relative(process.cwd(), filePath);
}

export function readCardFile(filePath: string): CardFile | null {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Parse frontmatter
    const match = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
    
    if (!match) {
      return null;
    }
    
    const frontmatter = yaml.load(match[1]) as CardFrontmatter;
    const cardContent = match[2].trim();
    
    return {
      frontmatter,
      content: cardContent
    };
  } catch (error) {
    console.error('Error reading card file:', error);
    return null;
  }
}

export function updateCardFile(
  filePath: string,
  updates: Partial<CardFrontmatter>,
  newContent?: string
): boolean {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const cardFile = readCardFile(filePath);
    
    if (!cardFile) return false;
    
    const updatedFrontmatter = {
      ...cardFile.frontmatter,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    const content = newContent !== undefined ? newContent : cardFile.content;
    
    const fileContent = serializeCardFile(updatedFrontmatter, content);
    
    fs.writeFileSync(fullPath, fileContent, 'utf-8');
    return true;
  } catch (error) {
    console.error('Error updating card file:', error);
    return false;
  }
}

export function deleteCardFile(filePath: string): boolean {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    fs.unlinkSync(fullPath);
    return true;
  } catch (error) {
    console.error('Error deleting card file:', error);
    return false;
  }
}

export function getAllCardsForSession(sessionId: string): CardFile[] {
  const cardsDir = path.join(getSessionDir(sessionId), 'cards');
  
  if (!fs.existsSync(cardsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(cardsDir);
  const cards: CardFile[] = [];
  
  for (const file of files) {
    if (file.endsWith('.md')) {
      const filePath = path.join(cardsDir, file);
      const card = readCardFile(filePath);
      if (card) {
        cards.push(card);
      }
    }
  }
  
  // Sort by order
  return cards.sort((a, b) => a.frontmatter.order - b.frontmatter.order);
}

export function writeSessionMetadata(
  sessionId: string,
  metadata: {
    id: string;
    name: string;
    projectClient?: string;
    projectBackground?: string;
    projectNotes?: string;
    createdAt: string;
    updatedAt: string;
  }
): void {
  ensureSessionDir(sessionId);
  
  const filePath = path.join(getSessionDir(sessionId), 'session.json');
  fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2), 'utf-8');
}

export function writeConnections(
  sessionId: string,
  connections: Array<{ id: string; from: string; to: string; threadId?: string; color?: string; ownerUserId?: string }>
): void {
  ensureSessionDir(sessionId);
  
  const filePath = path.join(getSessionDir(sessionId), 'connections.json');
  fs.writeFileSync(filePath, JSON.stringify(connections, null, 2), 'utf-8');
}

export function readConnections(sessionId: string): Array<{ id: string; from: string; to: string }> {
  const filePath = path.join(getSessionDir(sessionId), 'connections.json');
  
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
}
