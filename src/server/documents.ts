import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import JSZip from "jszip";
import { PDFParse } from "pdf-parse";
import WordExtractor from "word-extractor";

const execFileAsync = promisify(execFile);
const TEXT_EXTENSIONS = new Set([".txt", ".md"]);
const TEXT_MIME_TYPES = new Set(["text/plain", "text/markdown", "text/x-markdown"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const PDF_MIME_TYPES = new Set(["application/pdf"]);
const DOCX_EXTENSIONS = new Set([".docx"]);
const DOCX_MIME_TYPES = new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const LEGACY_DOC_EXTENSIONS = new Set([".doc"]);
const LEGACY_DOC_MIME_TYPES = new Set(["application/msword"]);

export interface ProjectAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  relativePath: string;
  extractionStatus: "ready" | "unsupported" | "error";
  extractedText: string;
  summary: string;
  note?: string;
}

function getPythonExecutable(): string {
  const candidates = [
    process.env.BBP_PYTHON_PATH,
    "/Users/HAND/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3",
    "python3",
  ].filter(Boolean) as string[];

  return candidates[0];
}

function limitText(value: string, limit = 20_000): string {
  return value.trim().slice(0, limit);
}

function extractPlainText(filePath: string): Pick<ProjectAttachment, "extractionStatus" | "extractedText" | "summary"> {
  const text = limitText(fs.readFileSync(filePath, "utf-8"));
  return {
    extractionStatus: text ? "ready" : "unsupported",
    extractedText: text,
    summary: text ? text.slice(0, 500) : `Uploaded text document: ${path.basename(filePath)}`,
  };
}

async function extractPdfText(filePath: string): Promise<Pick<ProjectAttachment, "extractionStatus" | "extractedText" | "summary">> {
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  try {
    const result = await parser.getText();
    const text = limitText(result.text || "");
    return {
      extractionStatus: text ? "ready" : "unsupported",
      extractedText: text,
      summary: text ? text.slice(0, 500) : `Uploaded PDF: ${path.basename(filePath)}`,
    };
  } finally {
    await parser.destroy();
  }
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function extractDocxText(filePath: string): Promise<Pick<ProjectAttachment, "extractionStatus" | "extractedText" | "summary">> {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const documentXml = await zip.file("word/document.xml")?.async("string");

  if (!documentXml) {
    return {
      extractionStatus: "unsupported",
      extractedText: "",
      summary: `Uploaded Word document: ${path.basename(filePath)}`,
    };
  }

  const normalizedXml = documentXml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n\n");
  const textRuns = Array.from(normalizedXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
    .map((match) => decodeXmlText(match[1]))
    .join("");
  const text = limitText(textRuns.replace(/\n{3,}/g, "\n\n"));

  return {
    extractionStatus: text ? "ready" : "unsupported",
    extractedText: text,
    summary: text ? text.slice(0, 500) : `Uploaded Word document: ${path.basename(filePath)}`,
  };
}

async function extractLegacyDocText(filePath: string): Promise<Pick<ProjectAttachment, "extractionStatus" | "extractedText" | "summary">> {
  const extractor = new WordExtractor();
  const document = await extractor.extract(fs.readFileSync(filePath));
  const text = limitText([
    document.getBody(),
    document.getFootnotes(),
    document.getEndnotes(),
    document.getHeaders(),
    document.getFooters(),
    document.getAnnotations(),
    document.getTextboxes(),
  ].filter(Boolean).join("\n\n"));

  return {
    extractionStatus: text ? "ready" : "unsupported",
    extractedText: text,
    summary: text ? text.slice(0, 500) : `Uploaded Word document: ${path.basename(filePath)}`,
  };
}

function shouldUseNativeTextExtraction(filePath: string, mimeType?: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  const normalizedMimeType = (mimeType || "").split(";")[0].trim().toLowerCase();
  return TEXT_EXTENSIONS.has(extension) || TEXT_MIME_TYPES.has(normalizedMimeType);
}

function shouldUseNativePdfExtraction(filePath: string, mimeType?: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  const normalizedMimeType = (mimeType || "").split(";")[0].trim().toLowerCase();
  return PDF_EXTENSIONS.has(extension) || PDF_MIME_TYPES.has(normalizedMimeType);
}

function shouldUseNativeDocxExtraction(filePath: string, mimeType?: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  const normalizedMimeType = (mimeType || "").split(";")[0].trim().toLowerCase();
  return DOCX_EXTENSIONS.has(extension) || DOCX_MIME_TYPES.has(normalizedMimeType);
}

function shouldUseNativeLegacyDocExtraction(filePath: string, mimeType?: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  const normalizedMimeType = (mimeType || "").split(";")[0].trim().toLowerCase();
  return LEGACY_DOC_EXTENSIONS.has(extension) || LEGACY_DOC_MIME_TYPES.has(normalizedMimeType);
}

export async function extractAttachmentContent(
  filePath: string,
  mimeType?: string
): Promise<Pick<ProjectAttachment, "extractionStatus" | "extractedText" | "summary">> {
  if (shouldUseNativeTextExtraction(filePath, mimeType)) {
    try {
      return extractPlainText(filePath);
    } catch (error) {
      console.error("Native text attachment extraction error:", error);
      return {
        extractionStatus: "error",
        extractedText: "",
        summary: "We stored the file, but text extraction failed for this document.",
      };
    }
  }

  if (shouldUseNativePdfExtraction(filePath, mimeType)) {
    try {
      return await extractPdfText(filePath);
    } catch (error) {
      console.error("Native PDF attachment extraction error:", error);
      return {
        extractionStatus: "error",
        extractedText: "",
        summary: "We stored the file, but PDF extraction failed for this document.",
      };
    }
  }

  if (shouldUseNativeDocxExtraction(filePath, mimeType)) {
    try {
      return await extractDocxText(filePath);
    } catch (error) {
      console.error("Native Word attachment extraction error:", error);
      return {
        extractionStatus: "error",
        extractedText: "",
        summary: "We stored the file, but Word document extraction failed for this document.",
      };
    }
  }

  if (shouldUseNativeLegacyDocExtraction(filePath, mimeType)) {
    try {
      return await extractLegacyDocText(filePath);
    } catch (error) {
      console.error("Native legacy Word attachment extraction error:", error);
      return {
        extractionStatus: "error",
        extractedText: "",
        summary: "We stored the file, but legacy Word document extraction failed for this document.",
      };
    }
  }

  const scriptPath = path.join(process.cwd(), "scripts", "extract_attachment.py");
  const python = getPythonExecutable();

  if (!fs.existsSync(scriptPath)) {
    return {
      extractionStatus: "error",
      extractedText: "",
      summary: "Attachment extractor script is missing.",
    };
  }

  try {
    const { stdout } = await execFileAsync(python, [scriptPath, filePath], {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 10,
    });
    const parsed = JSON.parse(stdout);
    const extractedText = typeof parsed.extractedText === "string" ? parsed.extractedText.trim() : "";
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";

    return {
      extractionStatus: extractedText || summary ? "ready" : "unsupported",
      extractedText,
      summary: summary || "Document uploaded successfully.",
    };
  } catch (error: any) {
    console.error("Attachment extraction error:", error);
    return {
      extractionStatus: "error",
      extractedText: "",
      summary: "We stored the file, but extraction failed for this document.",
    };
  }
}
