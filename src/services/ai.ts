import { apiUrl } from '../config/api';
import type { ProjectBriefQuestion, ProjectBriefQuestionnaire } from '../config/projectBriefQuestionnaire';
import {
  ACT1_CARD_CHARACTER_LIMIT,
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
  return Boolean(content)
    && content.length <= ACT1_CARD_CHARACTER_LIMIT
    && !content.includes('\n')
    && !hasMultipleSentences(content);
}

function assertValidSingleAct1Idea(section: string, content: string) {
  if (!isAct1SectionId(section)) {
    throw new Error(`The AI model returned an unsupported section: ${section}`);
  }

  if (!isValidAct1CardContent(content)) {
    throw new Error(`The AI model returned an invalid ${getSectionLabel(section)} idea. Please regenerate.`);
  }
}

function buildAct1CardGenerationInstructions() {
  return `
    ACT 1 generation rules:
    - Generate Act I as a progressive narrative argument, not isolated sentences.
    - The flow is Setting -> Role -> Point A -> Point B -> Call to Action.
    - Each section must introduce new information, increase clarity or urgency, and move the story forward.
    - Generate exactly 3 options per section.
    - Each option must be a single sentence of ${ACT1_CARD_CHARACTER_LIMIT} characters or less.
    - Each option must contain one idea only and be readable as a standalone presentation headline.
    - Use active voice, present tense, clear conversational language, audience-focused framing, and compressed phrasing.
    - Avoid corporate jargon, buzzwords, marketing language, sales language, formal phrasing, and multi-idea sentences.
    - Do not include product names, product features, implementation details, technical architecture, marketing claims, company-centric framing, or solution details except in Call to Action.
    - Determine direct audience mode ("you", "your") or shared perspective mode ("we", "our", "us") from the Project Overview.
    - Use the same perspective across all five sections.
    - Do not default to "You..." for every sentence.
    - Vary openings across pronoun-led, environment-led, situation-led, pressure-led, and outcome-led structures.
    - Across all options, no more than 2 sentences should start with the same word.
    - Do not repeat previous sections, mirror Point A in Point B form, or turn Point B into Call to Action wording.
    - Before returning, verify: 3 options per section, ${ACT1_CARD_CHARACTER_LIMIT} characters or less, one idea per sentence, consistent perspective, no repetition, natural spoken phrasing.

    Section-specific rules:
    - place (Setting): Define the environment the audience operates in. Include industry conditions, external pressures, market dynamics, or operational environment. Exclude problems, solutions, and outcomes.
    - role (Role): Define audience responsibility. Include accountability, ownership, leadership, or mission. Exclude problems, outcomes, and frustration.
    - point_a (Point A): Describe current friction or limitation. Include friction, inefficiency, constraints, or selective grounded risks. At least 1 option should be a standard challenge; at least 2 should include stakes when contextually appropriate. Avoid exaggeration and fear-based language.
    - point_b (Point B): Define the desired future state. Include improved capability, success state, or operational benefit. Exclude methods, tools, and implementation.
    - change (Call to Action): Define the required shift to move from Point A to Point B. Include decisions, commitments, strategic shifts, or organizational change. Exclude product pitches, benefits, and outcomes already stated in Point B.
  `;
}

async function requestTextCompletion(
  prompt: string,
  model: ModelType,
  responseFormat?: 'json'
): Promise<string> {
  const response = await fetch(apiUrl("/api/ai/complete"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prompt, model, responseFormat })
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { error: await response.text() };
    }

    const errorMessage = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : errorData.error;
    throw new Error(errorMessage || `AI completion error: ${response.status}`);
  }

  const data = await response.json();
  return data.text || "";
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

export async function generateCards(client: string, background: string, notes: string, model: ModelType = 'minimax-m3'): Promise<CardData[]> {
  const prompt = `
    You are an expert presentation strategist using the "Beyond Bulletpoints" methodology.
    Based on the following project context, generate Act I headline options for the canvas.

    Client: ${client || 'Unknown Client'}
    Project Overview: ${background || 'No background provided.'}
    Additional Notes: ${notes || 'None.'}

    ${buildAct1CardGenerationInstructions()}
    
    IMPORTANT: You must return ONLY a valid JSON array of objects. Do not include markdown formatting like \`\`\`json.
    Ensure all double quotes inside the content strings are properly escaped (e.g., \\").
    Each object must have exactly two properties:
    - "section": Must be one of: ${ACT1_SECTION_IDS.map((section) => `"${section}"`).join(', ')}
    - "content": The idea content as a string.
  `;

  try {
    const responseText = await requestTextCompletion(prompt, model, 'json');
    let cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const startIndex = cleanedText.indexOf('[');
    const endIndex = cleanedText.lastIndexOf(']');
    const jsonStr =
      startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex
        ? cleanedText.substring(startIndex, endIndex + 1)
        : cleanedText;

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse JSON from model:", jsonStr);
      // Attempt a very basic cleanup of unescaped quotes inside strings if possible, 
      // but usually it's better to just throw and let the user retry.
      throw new Error("The AI model returned malformed JSON. Please try again.");
    }
    if (!Array.isArray(parsed)) {
      throw new Error("The AI model returned malformed JSON. Please try again.");
    }

    const cardsBySection = ACT1_SECTION_IDS.reduce((acc, section) => {
      acc[section] = [];
      return acc;
    }, {} as Record<Act1SectionId, string[]>);

    parsed.forEach((item: any) => {
      if (!isAct1SectionId(item?.section)) return;
      const content = normalizeGeneratedSentence(item.content);
      if (!isValidAct1CardContent(content)) return;
      if (cardsBySection[item.section].length < 3) {
        cardsBySection[item.section].push(content);
      }
    });

    const incompleteSection = ACT1_SECTION_IDS.find((section) => cardsBySection[section].length < 3);
    if (incompleteSection) {
      throw new Error(`The AI model did not return 3 valid ${getSectionLabel(incompleteSection)} cards. Please regenerate.`);
    }

    return ACT1_SECTION_IDS.flatMap((section) => cardsBySection[section].map((content, index) => ({
      id: `gen-${section}-${index}`,
      section,
      content,
      starred: false
    })));
  } catch (error) {
    console.error("Error generating cards:", error);
    throw error;
  }
}

export async function generateSingleIdea(client: string, background: string, notes: string, section: string, model: ModelType = 'minimax-m3'): Promise<string> {
  if (!isAct1SectionId(section)) {
    throw new Error(`Unsupported Act I section: ${section}`);
  }

  const prompt = `
    You are an expert presentation strategist using the "Beyond Bulletpoints" methodology.
    Based on the following project context, generate ONE concise, engaging headline for the "${getSectionLabel(section)}" section of Act I.

    Client: ${client || 'Unknown Client'}
    Project Overview: ${background || 'No background provided.'}
    Additional Notes: ${notes || 'None.'}

    ${buildAct1CardGenerationInstructions()}

    Return one option for the requested section only.
    Return ONLY the headline text, nothing else.
  `;

  try {
    const responseText = await requestTextCompletion(prompt, model);
    const idea = normalizeGeneratedSentence(responseText).replace(/^["']|["']$/g, '');
    assertValidSingleAct1Idea(section, idea);
    return idea;
  } catch (error) {
    console.error("Error generating single idea:", error);
    throw error;
  }
}

export async function synthesizeNoteIntoCard(
  client: string,
  background: string,
  projectNotes: string,
  sourceCard: Pick<CardData, 'section' | 'content'>,
  noteText: string,
  model: ModelType = 'minimax-m3'
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
    - Maximum ${ACT1_CARD_CHARACTER_LIMIT} characters.
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
  model: ModelType = 'minimax-m3'
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
  model: ModelType = 'minimax-m3',
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
  model: ModelType = 'minimax-m3'
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

export async function generateTransformationStory(client: string, background: string, notes: string, chainText: string, model: ModelType = 'minimax-m3'): Promise<string> {
  const prompt = `
    You are an expert presentation strategist using the "Beyond Bulletpoints" methodology.
    Based on the following project context and the sequence of connected ideas (the story chain), generate a cohesive, creative transformation story (a hero's journey for a business).
    This story should represent the transformation or action required to resolve the story chain and get the client from their current state to their desired destination.

    Client: ${client || 'Unknown Client'}
    Background: ${background || 'No background provided.'}
    Additional Notes: ${notes || 'None.'}

    Story Chain (Connected Ideas):
    ${chainText}

    The story should be an arc following the logical steps of the card columns: Setting > Role > Point A > Point B > Call to Action.
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

export async function generateChatResponse(client: string, background: string, notes: string, message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[], model: ModelType = 'minimax-m3', mode: 'new' | 'canvas' = 'canvas', context?: ChatGenerationContext): Promise<string> {
  let systemInstruction = '';
  const contextInstruction = `
    Current UI Context:
    - Session ID: ${context?.sessionId || 'Unknown'}
    - Session Name: ${context?.sessionName || 'Unknown'}
    - Can Edit: ${context?.canEdit ? 'yes' : 'no'}
    - Selected Card: ${context?.selectedCard ? `${context.selectedCard.section} :: ${context.selectedCard.content}` : 'none'}
    - Uploaded context sources:
${(context?.attachments && context.attachments.length > 0)
  ? context.attachments.map((attachment) => `      * ${attachment.name}: ${attachment.summary}${attachment.note ? `\n        Note: ${attachment.note}` : ''}`).join('\n')
  : '      * none'}

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
