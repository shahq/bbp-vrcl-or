import {
  ACT1_CARD_GENERATION_TARGET,
  ACT1_SECTION_IDS,
  getSectionLabel,
  type Act1SectionId,
} from './canvasSections';

type Act1SectionPromptRule = {
  fullRule: string;
  compactRule: string;
};

const ACT1_SECTION_PROMPT_RULES: Record<Act1SectionId, Act1SectionPromptRule> = {
  place: {
    fullRule: 'Define the environment the audience operates in. Include industry conditions, external pressures, market dynamics, or operational environment. Exclude problems, solutions, and outcomes.',
    compactRule: "Name the audience's operating environment. Do not mention the problem, solution, or outcome.",
  },
  role: {
    fullRule: 'Define audience responsibility. Include accountability, ownership, leadership, or mission. Exclude problems, outcomes, and frustration.',
    compactRule: "Name the audience's responsibility or ownership. Do not mention frustration or outcomes.",
  },
  point_a: {
    fullRule: 'Describe current friction or limitation. Include friction, inefficiency, constraints, or selective grounded risks. At least 1 option should be a standard challenge; at least 2 should include stakes when contextually appropriate. Avoid exaggeration and fear-based language.',
    compactRule: 'Name the current friction, constraint, or risk. Keep it grounded and specific.',
  },
  point_b: {
    fullRule: 'Define the desired future state. Include improved capability, success state, or operational benefit. Exclude methods, tools, and implementation.',
    compactRule: 'Name the desired future state or capability. Do not mention methods, tools, or implementation.',
  },
  change: {
    fullRule: 'Define the required shift to move from Challenge to Desired end state. Include decisions, commitments, strategic shifts, or organizational change. Exclude product pitches, benefits, and outcomes already stated in Desired end state.',
    compactRule: 'Name the strategic shift required to move forward. Do not pitch a product or repeat the outcome.',
  },
};

function limitPromptText(value: string, limit: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

export function getAct1PromptFlow(): string {
  return ACT1_SECTION_IDS.map((section) => getSectionLabel(section)).join(' -> ');
}

export function getAct1SingleIdeaSectionRule(section: Act1SectionId): string {
  return ACT1_SECTION_PROMPT_RULES[section].compactRule;
}

export function buildAct1CardGenerationInstructions(): string {
  return `
    ACT 1 generation rules:
    - Generate Act I as a progressive narrative argument, not isolated sentences.
    - The flow is ${getAct1PromptFlow()}
    - Each section must introduce new information, increase clarity or urgency, and move the story forward.
    - Generate exactly 3 options per section.
    - Each option must be a single sentence of ${ACT1_CARD_GENERATION_TARGET} characters or less.
    - Each option must contain one idea only and be readable as a standalone presentation headline.
    - Use active voice, present tense, clear conversational language, audience-focused framing, and compressed phrasing.
    - Avoid corporate jargon, buzzwords, marketing language, sales language, formal phrasing, and multi-idea sentences.
    - Do not include product names, product features, implementation details, technical architecture, marketing claims, company-centric framing, or solution details except in ${getSectionLabel('change')}.
    - Determine direct audience mode ("you", "your") or shared perspective mode ("we", "our", "us") from the Project Overview.
    - Use the same perspective across all five sections.
    - Do not default to "You..." for every sentence.
    - Vary openings across pronoun-led, environment-led, situation-led, pressure-led, and outcome-led structures.
    - Across all options, no more than 2 sentences should start with the same word.
    - Do not repeat previous sections, mirror ${getSectionLabel('point_a')} in ${getSectionLabel('point_b')} form, or turn ${getSectionLabel('point_b')} into ${getSectionLabel('change')} wording.
    - Before returning, verify: 3 options per section, ${ACT1_CARD_GENERATION_TARGET} characters or less, one idea per sentence, consistent perspective, no repetition, natural spoken phrasing.

    Section-specific rules:
${ACT1_SECTION_IDS.map((section) => `    - ${section} (${getSectionLabel(section)}): ${ACT1_SECTION_PROMPT_RULES[section].fullRule}`).join('\n')}
  `;
}

export function buildAct1BulkCardPrompt({
  client,
  background,
  notes,
}: {
  client: string;
  background: string;
  notes: string;
}): string {
  return `
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
}

export function buildAct1SectionCardPrompt({
  section,
  client,
  background,
  notes,
  storyContext,
  existingIdeas,
}: {
  section: Act1SectionId;
  client: string;
  background: string;
  notes: string;
  storyContext: string;
  existingIdeas: string;
}): string {
  return `
    Generate exactly 3 polished headline options for the "${getSectionLabel(section)}" column of an Act I presentation canvas.

    Project context:
    Client: ${limitPromptText(client || 'Unknown Client', 160)}
    Project Overview:
    ${background || 'No background provided.'}
    Notes: ${notes || 'None.'}

    Story arc so far (read these cards in sequence to understand the narrative):
    ${storyContext}

    Your task: Generate 3 cards that ADVANCE the story arc above.
    - Each card must be a natural next step from the previous sections.
    - Build on the narrative, don't just echo it.
    - The 3 cards should explore different angles of the SAME story step.
    - They must read as a coherent continuation when placed after the previous sections.

    Rule: ${getAct1SingleIdeaSectionRule(section)}
    Existing cards to avoid:
    ${existingIdeas}

    Constraints: single sentence, ${ACT1_CARD_GENERATION_TARGET} characters max, valid JSON only.
    JSON shape: [{"section":"${section}","content":"headline"}]
  `;
}

export function buildAct1SingleIdeaPrompt({
  section,
  client,
  background,
  notes,
  existingIdeas,
}: {
  section: Act1SectionId;
  client: string;
  background: string;
  notes: string;
  existingIdeas: string;
}): string {
  return `
    Generate ONE concise presentation headline for the "${getSectionLabel(section)}" column.

    Use only this compact context:
    Client: ${limitPromptText(client || 'Unknown Client', 120)}
    Project overview excerpt: ${limitPromptText(background || 'No background provided.', 700)}
    Notes excerpt: ${limitPromptText(notes || 'None.', 250)}

    Column rule: ${getAct1SingleIdeaSectionRule(section)}

    Existing "${getSectionLabel(section)}" cards to avoid:
    ${existingIdeas}

    Output rules:
    - Return only the headline text.
    - One sentence only.
    - ${ACT1_CARD_GENERATION_TARGET} characters or less.
    - Clear, active, conversational language.
    - No jargon, markdown, bullets, quotes, or labels.
  `;
}
