import { apiUrl } from '../config/api';
import {
  buildAct1BulkCardPrompt,
  buildAct1SectionCardPrompt,
  buildAct1SingleIdeaPrompt,
} from '../config/act1PromptSpec';
import type { ProjectBriefQuestion, ProjectBriefQuestionnaire } from '../config/projectBriefQuestionnaire';
import {
  ACT1_CARD_CHARACTER_LIMIT,
  ACT1_CARD_GENERATION_TARGET,
  ACT1_SECTION_IDS,
  getSectionLabel,
  isAct1SectionId,
  type Act1SectionId,
} from '../config/canvasSections';
import { CardData, ProjectAttachment } from '../types';

export type ModelType = string;
interface ChatGenerationContext {
  sessionId?: string;
  sessionName?: string;
  canEdit?: boolean;
  selectedCard?: Pick<CardData, 'id' | 'section' | 'content' | 'starred'> | null;
  attachments?: Array<{
    name: string;
    summary: string;
    extractedText?: string;
    note?: string;
  }>;
}

function normalizeGeneratedSentence(content: unknown): string {
  return typeof content === 'string' ? content.replace(/\s+/g, ' ').trim() : '';
}

function hasMultipleSentences(content: string): boolean {
  const sentenceEnds = content.match(/[.!?](?=\s|$)/g);
  return Boolean(sentenceEnds && sentenceEnds.length > 1);
}

function isValidAct1CardContent(content: string): boolean {
  const isEmpty = !Boolean(content);
  const tooLong = content.length > ACT1_CARD_CHARACTER_LIMIT;
  const hasNewline = content.includes('\n');
  const multiSentence = hasMultipleSentences(content);
  const valid = !isEmpty && !tooLong && !hasNewline && !multiSentence;
  if (!valid) {
    console.warn('[AI] isValidAct1CardContent REJECTED:', {
      isEmpty,
      tooLong,
      charLimit: ACT1_CARD_CHARACTER_LIMIT,
      actualLength: content.length,
      hasNewline,
      multiSentence,
      preview: content.slice(0, 120),
    });
  }
  return valid;
}

function assertValidSingleAct1Idea(section: string, content: string) {
  if (!isAct1SectionId(section)) {
    console.warn('[AI] assertValidSingleAct1Idea REJECTED — unsupported section:', { section, preview: content.slice(0, 60) });
    throw new Error(`The AI model returned an unsupported section: ${section}`);
  }

  if (!isValidAct1CardContent(content)) {
    console.warn('[AI] assertValidSingleAct1Idea REJECTED — invalid content:', { section, contentLength: content.length, preview: content.slice(0, 60) });
    throw new Error(`The AI model returned an invalid ${getSectionLabel(section)} idea. Please regenerate.`);
  }
}

function limitAttachmentText(value: string | undefined, limit = 2_500): string {
  const text = (value || '').trim();
  return text.length > limit ? `${text.slice(0, limit)}\n[Excerpt truncated]` : text;
}

function formatChatAttachmentContext(attachments: ChatGenerationContext['attachments']): string {
  if (!attachments || attachments.length === 0) {
    return '      * none';
  }

  return attachments.map((attachment) => {
    const summary = attachment.summary?.trim() || 'No summary available.';
    const extractedText = limitAttachmentText(attachment.extractedText);
    return [
      `      * ${attachment.name}`,
      `        Summary: ${summary}`,
      attachment.note?.trim() ? `        Note: ${attachment.note.trim()}` : '',
      extractedText ? `        Extracted text excerpt: ${extractedText}` : '',
    ].filter(Boolean).join('\n');
  }).join('\n');
}

function formatExistingIdeas(cards: Pick<CardData, "section" | "content">[] | undefined, section: Act1SectionId) {
  const ideas = (cards || [])
    .filter((card) => card.section === section && card.content.trim())
    .map((card) => `- ${card.content.trim()}`)
    .slice(0, 6);

  return ideas.length > 0 ? ideas.join("\n") : "- none";
}

function inferFallbackSubject(background: string, notes: string): string {
  const text = `${background} ${notes}`.toLowerCase();
  if (text.includes("launch")) return "Launch work";
  if (text.includes("customer")) return "Customer work";
  if (text.includes("sales")) return "Sales work";
  if (text.includes("operations") || text.includes("operational")) return "Operational work";
  if (text.includes("team")) return "Team work";
  return "The work";
}

function createFallbackSingleIdea(section: Act1SectionId, background: string, notes: string): string {
  console.warn('[AI] createFallbackSingleIdea TRIGGERED:', { section, backgroundLength: background.length, notesLength: notes.length });
  const subject = inferFallbackSubject(background, notes);
  const fallbacks: Record<Act1SectionId, string> = {
    place: `${subject} moves through a fast-changing environment`,
    role: `Your team owns the handoffs that keep progress moving`,
    point_a: `Disconnected handoffs slow progress and weaken alignment`,
    point_b: `Teams need shared context and faster handoffs`,
    change: `The team needs a clearer way to coordinate the work`,
  };
  return fallbacks[section];
}

function createFallbackSectionCards(section: Act1SectionId, background: string, notes: string): CardData[] {
  console.warn('[AI] createFallbackSectionCards TRIGGERED:', { section, backgroundLength: background.length, notesLength: notes.length });
  const subject = inferFallbackSubject(background, notes);
  const fallbackContent: Record<Act1SectionId, string[]> = {
    place: [
      `${subject} is moving through a fast-changing operating environment`,
      `Teams are making decisions with more pressure and less room for drift`,
      `The audience is working where alignment matters quickly`,
    ],
    role: [
      `Your team owns the choices that keep the work moving`,
      `Leaders turn scattered context into shared direction`,
      `The audience coordinates people, priorities, and momentum`,
    ],
    point_a: [
      `Disconnected context slows decisions and weakens follow-through`,
      `Important signals are spread across too many conversations and files`,
      `Teams lose time translating the work before they can move it forward`,
    ],
    point_b: [
      `Teams need shared context that makes the next move obvious`,
      `The future state is faster alignment around the work that matters most`,
      `Everyone sees the same story before decisions start branching`,
    ],
    change: [
      `The team needs a clearer way to turn context into action`,
      `Progress depends on making the story visible before the work fragments`,
      `The shift is from scattered inputs to a shared working narrative`,
    ],
  };

  return fallbackContent[section].map((content, index) => ({
    id: `fallback-${section}-${index}`,
    section,
    content: normalizeGeneratedSentence(content),
    starred: false,
  }));
}

function parseGeneratedCardItems(responseText: string): Array<{ section: Act1SectionId; content: string }> {
  console.log('[AI] parseGeneratedCardItems START. responseText length:', responseText.length);
  const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const startIndex = cleanedText.indexOf('[');
  const endIndex = cleanedText.lastIndexOf(']');
  const jsonStr =
    startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex
      ? cleanedText.substring(startIndex, endIndex + 1)
      : cleanedText;
  console.log('[AI] parseGeneratedCardItems: bracket extraction', { startIndex, endIndex, jsonStrLength: jsonStr.length });

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('[AI] parseGeneratedCardItems JSON parse FAILED:', { jsonStrLength: jsonStr.length, preview: jsonStr.slice(0, 200) });
    throw new Error("The AI model returned malformed JSON. Please try again.");
  }

  if (!Array.isArray(parsed)) {
    console.error('[AI] parseGeneratedCardItems: parsed is NOT an array. Type:', typeof parsed);
    throw new Error("The AI model returned malformed JSON. Please try again.");
  }

  let keptCount = 0;
  let discardedCount = 0;
  const result = parsed.flatMap((item: any) => {
    if (!isAct1SectionId(item?.section)) {
      console.warn('[AI] parseGeneratedCardItems DISCARDED — bad section:', { section: item?.section, preview: String(item?.content).slice(0, 60) });
      discardedCount++;
      return [];
    }
    const content = normalizeGeneratedSentence(item.content);
    if (isValidAct1CardContent(content)) {
      keptCount++;
      return [{ section: item.section, content }];
    }
    discardedCount++;
    return [];
  });
  console.log('[AI] parseGeneratedCardItems DONE:', { keptCount, discardedCount, totalItems: parsed.length });
  return result;
}

async function requestTextCompletion(
  prompt: string,
  model: ModelType,
  responseFormat?: 'json',
  signal?: AbortSignal,
  maxOutputTokens?: number
): Promise<string> {
  console.log('[AI] requestTextCompletion START:', { model, responseFormat, maxOutputTokens });
  const response = await fetch(apiUrl("/api/ai/complete"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prompt, model, responseFormat, maxOutputTokens }),
    signal,
  });

  console.log('[AI] requestTextCompletion response status:', response.status);
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { error: await response.text() };
    }

    const errorMessage = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : errorData.error;
    console.error('[AI] requestTextCompletion FAILED:', { status: response.status, errorMessage });
    throw new Error(errorMessage || `AI completion error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[AI] requestTextCompletion SUCCESS. response text length:', (data.text || '').length);
  return data.text || "";
}

async function requestTextCompletionWithTimeout(
  prompt: string,
  model: ModelType,
  timeoutMs = 12_000,
  maxOutputTokens?: number,
  responseFormat?: 'json'
): Promise<string> {
  console.log('[AI] requestTextCompletionWithTimeout START:', { model, timeoutMs, responseFormat });
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    console.warn('[AI] requestTextCompletionWithTimeout ABORTED after', timeoutMs, 'ms');
    controller.abort();
  }, timeoutMs);

  try {
    const result = await requestTextCompletion(prompt, model, responseFormat, controller.signal, maxOutputTokens);
    console.log('[AI] requestTextCompletionWithTimeout completed within', timeoutMs, 'ms');
    return result;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function requestTextCompletionStream(
  prompt: string,
  model: ModelType,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(apiUrl("/api/ai/complete-stream"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prompt, model }),
    signal,
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { error: await response.text() };
    }

    const errorMessage = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : errorData.error;
    throw new Error(errorMessage || `AI streaming completion error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("AI streaming response did not include a body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;

      fullText += chunk;
      onChunk(chunk);
    }

    const finalChunk = decoder.decode();
    if (finalChunk) {
      fullText += finalChunk;
      onChunk(finalChunk);
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}

async function requestChatCompletion(
  systemInstruction: string,
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  message: string,
  model: ModelType
): Promise<string> {
  const response = await fetch(apiUrl("/api/ai/chat"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction,
      history,
      message,
      model
    })
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { error: await response.text() };
    }

    const errorMessage = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : errorData.error;
    throw new Error(errorMessage || `AI chat error: ${response.status}`);
  }

  const data = await response.json();
  return data.text || "";
}

export async function generateCards(client: string, background: string, notes: string, model: ModelType = 'kimi-k2.6'): Promise<CardData[]> {
  console.log('[AI] generateCards START:', { client: client || 'Unknown Client', backgroundLength: background.length, notesLength: notes.length, model });
  const prompt = buildAct1BulkCardPrompt({ client, background, notes });

  try {
    const responseText = await requestTextCompletion(prompt, model, 'json');
    const parsed = parseGeneratedCardItems(responseText);
    console.log('[AI] generateCards parsed total:', parsed.length);

    const cardsBySection = ACT1_SECTION_IDS.reduce((acc, section) => {
      acc[section] = [];
      return acc;
    }, {} as Record<Act1SectionId, string[]>);

    parsed.forEach((item) => {
      if (cardsBySection[item.section].length < 3) {
        cardsBySection[item.section].push(item.content);
      }
    });

    const sectionCounts = ACT1_SECTION_IDS.map((section) => ({ section, count: cardsBySection[section].length }));
    console.log('[AI] generateCards per-section distribution:', sectionCounts);

    const incompleteSection = ACT1_SECTION_IDS.find((section) => cardsBySection[section].length < 3);
    if (incompleteSection) {
      console.warn('[AI] generateCards INCOMPLETE section:', { section: incompleteSection, count: cardsBySection[incompleteSection].length });
      throw new Error(`The AI model did not return 3 valid ${getSectionLabel(incompleteSection)} cards. Please regenerate.`);
    }

    console.log('[AI] generateCards SUCCESS: all sections have 3 cards');
    return ACT1_SECTION_IDS.flatMap((section) => cardsBySection[section].map((content, index) => ({
      id: `gen-${section}-${index}`,
      section,
      content,
      starred: false
    })));
  } catch (error) {
    console.error('[AI] generateCards FAILED:', error);
    throw error;
  }
}

function formatStoryContext(storyContext: Pick<CardData, 'section' | 'content'>[]): string {
  if (!storyContext.length) return 'None yet. This is the first column.';
  return storyContext.map((card, index) => `${index + 1}. ${getSectionLabel(card.section)}: "${card.content}"`).join('\n');
}

export async function generateCardsForSection(
  client: string,
  background: string,
  notes: string,
  section: Act1SectionId,
  model: ModelType = 'kimi-k2.6',
  existingCards: Pick<CardData, 'section' | 'content'>[] = [],
  storyContext: Pick<CardData, 'section' | 'content'>[] = []
): Promise<CardData[]> {
  console.log('[AI] generateCardsForSection START:', { section, client: client || 'Unknown Client', backgroundLength: background.length, notesLength: notes.length, model, existingCardsCount: existingCards.length, storyContextCount: storyContext.length });

  const prompt = buildAct1SectionCardPrompt({
    section,
    client,
    background,
    notes,
    storyContext: formatStoryContext(storyContext),
    existingIdeas: formatExistingIdeas(existingCards, section),
  });

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const responseText = await requestTextCompletionWithTimeout(prompt, model, 60_000, undefined, 'json');
      const parsed = parseGeneratedCardItems(responseText)
        .filter((item) => item.section === section)
        .slice(0, 3);

      console.log('[AI] generateCardsForSection:', { section, attempt, parsedCount: parsed.length });
      if (parsed.length < 3) {
        console.warn('[AI] generateCardsForSection insufficient items:', { section, attempt, parsedCount: parsed.length });
        throw new Error(`The AI model did not return 3 valid ${getSectionLabel(section)} cards. Please regenerate.`);
      }

      console.log('[AI] generateCardsForSection SUCCESS:', { section, attempt, parsedCount: parsed.length });
      return parsed.map((item, index) => ({
        id: `gen-${section}-${index}`,
        section,
        content: item.content,
        starred: false,
      }));
    } catch (error) {
      const isAbortError = (error instanceof DOMException && error.name === 'AbortError') || (error instanceof Error && error.message.includes('AbortError'));
      console.warn('[AI] generateCardsForSection attempt failed:', { section, attempt, isAbortError, error });
      if (isAbortError && attempt < maxAttempts) {
        console.log('[AI] generateCardsForSection RETRYING:', { section, attempt, nextAttempt: attempt + 1 });
        continue;
      }
      console.error('[AI] generateCardsForSection FAILED after all retries:', { section, attempts: attempt });
      return createFallbackSectionCards(section, background, notes);
    }
  }

  return createFallbackSectionCards(section, background, notes);
}

export async function generateSingleIdea(
  client: string,
  background: string,
  notes: string,
  section: string,
  model: ModelType = 'kimi-k2.6',
  existingCards?: Pick<CardData, 'section' | 'content'>[]
): Promise<string> {
  console.log('[AI] generateSingleIdea START:', { section, client: client || 'Unknown Client', backgroundLength: background.length, notesLength: notes.length, model });
  if (!isAct1SectionId(section)) {
    console.error('[AI] generateSingleIdea FAILED — unsupported section:', { section });
    throw new Error(`Unsupported Act I section: ${section}`);
  }

  const prompt = buildAct1SingleIdeaPrompt({
    section,
    client,
    background,
    notes,
    existingIdeas: formatExistingIdeas(existingCards, section),
  });

  try {
    const responseText = await requestTextCompletionWithTimeout(prompt, model, 4_000);
    const idea = normalizeGeneratedSentence(responseText).replace(/^["']|["']$/g, '');
    console.log('[AI] generateSingleIdea raw response length:', responseText.length, 'idea length:', idea.length);
    assertValidSingleAct1Idea(section, idea);
    console.log('[AI] generateSingleIdea SUCCESS:', { section, ideaLength: idea.length });
    return idea;
  } catch (error) {
    console.error('[AI] generateSingleIdea FAILED:', { section, error });
    return createFallbackSingleIdea(section, background, notes);
  }
}

export async function synthesizeNoteIntoCard(
  client: string,
  background: string,
  projectNotes: string,
  sourceCard: Pick<CardData, 'section' | 'content'>,
  noteText: string,
  model: ModelType = 'kimi-k2.6'
): Promise<string> {
  const prompt = `
    You are an expert presentation strategist using the "Beyond Bulletpoints" methodology.
    Turn the user's note into ONE concise card sentence for the "${sourceCard.section}" section.

    Client: ${client || 'Unknown Client'}
    Background: ${background || 'No background provided.'}
    Project Notes: ${projectNotes || 'None.'}
    Selected Card: ${sourceCard.content || 'No selected card content.'}
    User Note:
    ${noteText}

    Requirements:
    - Return only the new card sentence.
    - Maximum ${ACT1_CARD_GENERATION_TARGET} characters.
    - Keep it concrete and useful for the current section.
    - Do not include quotes, markdown, bullets, labels, or explanation.
  `;

  try {
    const responseText = await requestTextCompletion(prompt, model);
    return responseText.trim().replace(/^["']|["']$/g, '') || "Synthesized card idea";
  } catch (error) {
    console.error("Error synthesizing note into card:", error);
    throw error;
  }
}

function buildBriefFromUploadsPrompt(
  client: string,
  existingBackground: string,
  notes: string,
  attachments: ProjectAttachment[]
): string {
  const usableAttachments = attachments
    .filter((attachment) => attachment.summary.trim() || attachment.extractedText.trim() || attachment.note?.trim());

  const sourceContext = usableAttachments
    .map((attachment, index) => {
      const extractedText = attachment.extractedText.trim();
      const excerpt = extractedText.length > 5000
        ? `${extractedText.slice(0, 5000)}\n[Excerpt truncated]`
        : extractedText;

      return `
Source ${index + 1}: ${attachment.name}
Status: ${attachment.extractionStatus}
Summary:
${attachment.summary || 'No summary available.'}
${attachment.note ? `Facilitator note:\n${attachment.note}` : ''}
${excerpt ? `Extracted text excerpt:\n${excerpt}` : ''}
      `.trim();
    })
    .join('\n\n---\n\n');

  const prompt = `
    You are an expert presentation strategist using the "Beyond Bulletpoints" methodology.
    Analyze the uploaded source material and write a clean Project Overview / brief that can be pasted directly into the app's Project Overview field.

    Client / project name: ${client || 'Unknown client'}
    Existing Project Overview, if any:
    ${existingBackground || 'None yet.'}

    Additional notes from facilitator:
    ${notes || 'None.'}

    Uploaded source material:
    ${sourceContext || 'No usable uploaded source material was provided.'}

    Requirements:
    - Return only the project overview text.
    - Synthesize across all ${usableAttachments.length} uploaded source document${usableAttachments.length === 1 ? '' : 's'}; do not rely on only the first or last source.
    - Do not list files one by one in the final brief.
    - Preserve important client context, goals, current needs, challenges, stakeholders, constraints, and success outcomes when present.
    - Use clear business language a facilitator can review and edit.
    - Do not invent facts not supported by the source material.
    - If there is an existing overview, improve and integrate it instead of ignoring it.
    - Keep it concise but useful, around 3-6 short paragraphs.
    - Do not use markdown headings, bullets, labels, or quoted wrappers.
  `;

  return prompt;
}

export async function generateBriefFromUploads(
  client: string,
  existingBackground: string,
  notes: string,
  attachments: ProjectAttachment[],
  model: ModelType = 'kimi-k2.6'
): Promise<string> {
  const prompt = buildBriefFromUploadsPrompt(client, existingBackground, notes, attachments);

  try {
    const responseText = await requestTextCompletion(prompt, model);
    return responseText.trim() || 'Generated project overview';
  } catch (error) {
    console.error('Error generating brief from uploads:', error);
    throw error;
  }
}

export async function generateBriefFromUploadsStream(
  client: string,
  existingBackground: string,
  notes: string,
  attachments: ProjectAttachment[],
  model: ModelType = 'kimi-k2.6',
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const prompt = buildBriefFromUploadsPrompt(client, existingBackground, notes, attachments);

  try {
    const responseText = await requestTextCompletionStream(prompt, model, onChunk, signal);
    const streamedText = responseText.trim();
    if (streamedText) {
      return streamedText;
    }

    if (signal?.aborted) {
      throw new DOMException('Brief generation stopped', 'AbortError');
    }

    return await requestTextCompletion(prompt, model);
  } catch (error) {
    console.error('Error streaming brief from uploads:', error);
    throw error;
  }
}

export async function generateProjectOverviewFromQuestionnaire(
  questionnaire: ProjectBriefQuestionnaire,
  answers: Record<string, string>,
  existingBackground: string,
  notes: string,
  model: ModelType = 'kimi-k2.6'
): Promise<string> {
  const answerContext = questionnaire.questions
    .map((question: ProjectBriefQuestion) => {
      const answer = answers[question.id]?.trim();
      return `${question.shortLabel} (${question.aiContextKey}):\n${answer || 'Not provided.'}`;
    })
    .join('\n\n');

  const prompt = `
    You are an expert presentation strategist using the "Beyond Bulletpoints" methodology.
    Turn the structured questionnaire answers into a clean Project Overview / brief that can be pasted directly into the app's Project Overview field.

    Questionnaire version: ${questionnaire.version}

    Questionnaire answers:
    ${answerContext}

    Existing Project Overview, if any:
    ${existingBackground || 'None yet.'}

    Additional notes from facilitator:
    ${notes || 'None.'}

    Requirements:
    - Return only the project overview text.
    - Synthesize the answers into coherent prose; do not list the questions one by one.
    - Preserve the client, project purpose, current situation, audience need, challenge, constraints, and success outcome when present.
    - Use clear business language a facilitator can review and edit.
    - Do not invent facts not present in the answers, existing overview, or notes.
    - If there is an existing overview, improve and integrate it instead of ignoring it.
    - Keep it concise but useful, around 3-5 short paragraphs.
    - Do not use markdown headings, bullets, labels, or quoted wrappers.
  `;

  try {
    const responseText = await requestTextCompletion(prompt, model);
    return responseText.trim() || 'Generated project overview';
  } catch (error) {
    console.error('Error generating project overview from questionnaire:', error);
    throw error;
  }
}

export async function generateTransformationStory(client: string, background: string, notes: string, chainText: string, model: ModelType = 'kimi-k2.6'): Promise<string> {
  const prompt = `
    You are an expert presentation strategist using the "Beyond Bulletpoints" methodology.
    Based on the following project context and the sequence of connected ideas (the story chain), generate a cohesive, creative transformation story (a hero's journey for a business).
    This story should represent the transformation or action required to resolve the story chain and get the client from their current state to their desired destination.

    Client: ${client || 'Unknown Client'}
    Background: ${background || 'No background provided.'}
    Additional Notes: ${notes || 'None.'}

    Story Chain (Connected Ideas):
    ${chainText}

    The story should be an arc following the logical steps of the card columns: Setting > Role > Challenge > Desired end state > How do we get there?
    Address the business/client directly in the third person (e.g., "You summoned your small team...", "They realized...").
    Write a creative tale that takes the reader on a short journey, establishing a setting, showing the hurdles, and mapping out the path to success.
    Make it dynamic, engaging, and directly connected to the provided nodes.
    Keep it concise but impactful (around 2-3 paragraphs).

    Return ONLY the transformation story text, nothing else.
  `;

  try {
    const responseText = await requestTextCompletion(prompt, model);
    return responseText.trim() || "Generated transformation story";
  } catch (error) {
    console.error("Error generating transformation story:", error);
    throw error;
  }
}

export async function generateChatResponse(client: string, background: string, notes: string, message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[], model: ModelType = 'kimi-k2.6', mode: 'new' | 'canvas' = 'canvas', context?: ChatGenerationContext): Promise<string> {
  let systemInstruction = '';
  const contextInstruction = `
    Current UI Context:
    - Session ID: ${context?.sessionId || 'Unknown'}
    - Session Name: ${context?.sessionName || 'Unknown'}
    - Can Edit: ${context?.canEdit ? 'yes' : 'no'}
    - Selected Card: ${context?.selectedCard ? `${context.selectedCard.section} :: ${context.selectedCard.content}` : 'none'}
    - Uploaded context sources:
${formatChatAttachmentContext(context?.attachments)}

    Behavior rules:
    - Be context aware and refer to the current screen and selection when helpful.
    - If you suggest changes to existing text, present them clearly as a proposal.
    - Do not imply edits have already been applied.
    - If editing is disabled, frame suggestions as recommendations only.
    - Use uploaded document context when it is relevant.
  `;

  if (mode === 'new') {
    systemInstruction = `
      You are an expert presentation strategist using the "Beyond Bulletpoints" methodology.
      Your goal is to conduct a guided Q&A to help the user define a comprehensive project background.
      
      You must ask the user the following questions to gather information. 
      CRITICAL RULE: You MUST ask exactly ONE question at a time. Never ask multiple questions in a single message. Wait for the user to answer the current question before moving to the next one.
      
      The questions to ask (one by one) are:
      - Who is the client?
      - What is their project about?
      - What is their current need?
      - Why are you helping them?
      - Anything else you'd like to add?
      
      IMPORTANT: Do NOT number the questions (e.g., do not say "Question 1 of 5" or "First question:"). Just ask the questions naturally in order.
      
      Current known info (if any):
      Client: ${client || 'Unknown'}
      Background: ${background || 'None'}
      Notes: ${notes || 'None'}
      ${contextInstruction}
      
      Once you have gathered the answers to ALL these questions, you MUST generate a cohesive, professional "Project Background" summary.
      When you are presenting a clean project background draft intended for direct insertion into the Project Background field, wrap ONLY the clean draft in these exact tags:
      <project-background>
      ...clean background only...
      </project-background>
      Do not put commentary, setup text, or closing remarks inside those tags.
    `;
  } else {
    systemInstruction = `
      You are an expert presentation strategist using the "Beyond Bulletpoints" methodology.
      Help the user brainstorm and refine their project background, client details, and notes.
      
      Current Project Context:
      Client: ${client || 'Unknown Client'}
      Background: ${background || 'No background provided.'}
      Additional Notes: ${notes || 'None.'}
      ${contextInstruction}
      
      Provide concise, helpful, and strategic advice. If a card is selected, you may help refine it, expand on it, or propose a new adjacent card in the same section.
    `;
  }

  try {
    const responseText = await requestChatCompletion(systemInstruction, history, message, model);
    return responseText.trim() || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error generating chat response:", error);
    throw error;
  }
}
