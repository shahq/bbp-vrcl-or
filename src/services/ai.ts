import { apiUrl } from '../config/api';
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

export async function generateCards(client: string, background: string, notes: string, model: ModelType = 'minimax-m2.5'): Promise<CardData[]> {
  const prompt = `
    You are an expert presentation strategist using the "Beyond Bulletpoints" methodology.
    Based on the following project context, generate ideas for the Act I story structure.

    Client: ${client || 'Unknown Client'}
    Background: ${background || 'No background provided.'}
    Additional Notes: ${notes || 'None.'}

    Generate 2-3 ideas for each of the following sections:
    - place: The setting or current situation of the audience/client.
    - role: The role the audience/client plays in this setting.
    - challenge: The main problem or obstacle they are facing.
    - point_a: Where they are right now (the starting point).
    - point_b: Where they need to be (the desired destination).
    - change: The transformation or action required to get from A to B.

    Make the ideas concise, engaging, and directly related to the provided context.
    Each idea must be a single sentence of maximum 100 characters.
    Address the business/client directly in the third person (e.g., "You are...", "They are...").
    
    IMPORTANT: You must return ONLY a valid JSON array of objects. Do not include markdown formatting like \`\`\`json.
    Ensure all double quotes inside the content strings are properly escaped (e.g., \\").
    Each object must have exactly two properties:
    - "section": Must be one of: "place", "role", "challenge", "point_a", "point_b", "change"
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
    
    const validSections = ['place', 'role', 'challenge', 'point_a', 'point_b', 'change'];
    
    return parsed
      .filter((item: any) => validSections.includes(item.section))
      .map((item: any, index: number) => ({
        id: `gen-c${index}`,
        section: item.section as any,
        content: item.content,
        starred: false
      }));
  } catch (error) {
    console.error("Error generating cards:", error);
    throw error;
  }
}

export async function generateSingleIdea(client: string, background: string, notes: string, section: string, model: ModelType = 'minimax-m2.5'): Promise<string> {
  const prompt = `
    You are an expert presentation strategist using the "Beyond Bulletpoints" methodology.
    Based on the following project context, generate ONE concise, engaging idea for the "${section}" section of Act I.

    Client: ${client || 'Unknown Client'}
    Background: ${background || 'No background provided.'}
    Additional Notes: ${notes || 'None.'}

    Section definitions:
    - place: The setting or current situation of the audience/client.
    - role: The role the audience/client plays in this setting.
    - challenge: The main problem or obstacle they are facing.
    - point_a: Where they are right now (the starting point).
    - point_b: Where they need to be (the desired destination).
    - change: The transformation or action required to get from A to B.
    - story: A creative tale that takes the reader on a short journey, establishing a setting, showing the hurdles and mapping out the path to success.

    The idea must be a single sentence of maximum 100 characters.
    Address the business/client directly in the third person (e.g., "You are...", "They are...").
    Return ONLY the idea text, nothing else.
  `;

  try {
    const responseText = await requestTextCompletion(prompt, model);
    return responseText.trim() || "Generated idea";
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
  model: ModelType = 'minimax-m2.5'
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
    - Maximum 100 characters.
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

export async function generateBriefFromUploads(
  client: string,
  existingBackground: string,
  notes: string,
  attachments: ProjectAttachment[],
  model: ModelType = 'minimax-m2.5'
): Promise<string> {
  const sourceContext = attachments
    .filter((attachment) => attachment.summary.trim() || attachment.extractedText.trim() || attachment.note?.trim())
    .slice(0, 8)
    .map((attachment, index) => {
      const extractedText = attachment.extractedText.trim();
      const excerpt = extractedText.length > 7000
        ? `${extractedText.slice(0, 7000)}\n[Excerpt truncated]`
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
    - Synthesize the documents; do not list files one by one.
    - Preserve important client context, goals, current needs, challenges, stakeholders, constraints, and success outcomes when present.
    - Use clear business language a facilitator can review and edit.
    - Do not invent facts not supported by the source material.
    - If there is an existing overview, improve and integrate it instead of ignoring it.
    - Keep it concise but useful, around 3-6 short paragraphs.
    - Do not use markdown headings, bullets, labels, or quoted wrappers.
  `;

  try {
    const responseText = await requestTextCompletion(prompt, model);
    return responseText.trim() || 'Generated project overview';
  } catch (error) {
    console.error('Error generating brief from uploads:', error);
    throw error;
  }
}

export async function generateTransformationStory(client: string, background: string, notes: string, chainText: string, model: ModelType = 'minimax-m2.5'): Promise<string> {
  const prompt = `
    You are an expert presentation strategist using the "Beyond Bulletpoints" methodology.
    Based on the following project context and the sequence of connected ideas (the story chain), generate a cohesive, creative transformation story (a hero's journey for a business).
    This story should represent the transformation or action required to resolve the story chain and get the client from their current state to their desired destination.

    Client: ${client || 'Unknown Client'}
    Background: ${background || 'No background provided.'}
    Additional Notes: ${notes || 'None.'}

    Story Chain (Connected Ideas):
    ${chainText}

    The story should be an arc following the logical steps of the card columns: Place > Role > Challenge > Point A > Point B > Change.
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

export async function generateChatResponse(client: string, background: string, notes: string, message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[], model: ModelType = 'gemini-3.1-pro-preview', mode: 'new' | 'canvas' = 'canvas', context?: ChatGenerationContext): Promise<string> {
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
