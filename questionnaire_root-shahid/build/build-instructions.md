# STRATEGIC INTELLIGENCE INTAKE SYSTEM
## BUILD INSTRUCTIONS (IDE-AGNOSTIC v1)

---

# 1. PURPOSE

You are building a production-ready AI-driven conversational web application.

The system is a Strategic Intelligence Intake Tool used for:
- consulting sales presentations
- RFP responses
- leadership presentations
- strategic communications planning

This is NOT a form builder.

This is a **conversational AI system with structured state-driven progression**.

---

# 2. CORE REQUIREMENTS

You must build a system that includes:

## A. Conversational UI
- One primary question per screen
- AI responds after each user input
- Chat-like interaction model (not form-based)

## B. State Machine Navigation
- System must follow `state-machine.md`
- Each state = one screen/step
- No skipping states unless explicitly allowed by fatigue rules

## C. AI Coaching Layer
- Implement AI behavior rules from `intake-system.md`
- AI must dynamically choose:
  - ACCEPT
  - CLARIFY
  - CHALLENGE

## D. Structured Data Capture
- All responses must be stored into schema defined in `schema.json`
- Data must be progressively accumulated across states

## E. Output Generation
At completion, system must generate:
1. Structured JSON output
2. Human-readable Strategic Discovery Report
3. Optional Story Tool payload

---

# 3. SYSTEM ARCHITECTURE

You must implement:

## FRONTEND
- Conversational UI interface
- Single active question display
- AI response area
- Progress indicator (optional but recommended)

## STATE ENGINE
- Controls flow based on `state-machine.md`
- Ensures correct sequencing
- Handles transitions and validation gates

## AI ENGINE
- Implements `ai-engine.md` behavior rules
- Processes each user input
- Returns:
  - response message
  - next question
  - optional clarification or challenge

## DATA STORE
- Maintains structured JSON object aligned to schema
- Updates in real-time per user response

---

# 4. STATE MACHINE RULES

System must strictly follow:

START → PROJECT_CONTEXT → AUDIENCE → PERCEPTION → COMPETITION → DIFFERENTIATION → EVIDENCE → EMOTIONAL_TARGETS → STRATEGIC_SYNTHESIS → COMPLETE

Rules:
- Do not skip states
- Do not merge states
- Do not advance unless minimum clarity threshold is met
- Allow clarification loops within state

---

# 5. AI BEHAVIOR RULES

AI must:

## Always:
- be audience-first
- improve clarity of thinking
- detect vague or cliché responses
- maintain conversational tone

## Never:
- finalize strategy
- assume missing information
- overload user with multiple questions
- proceed without minimum clarity

---

# 6. RESPONSE MODES

AI must classify each user response:

## MODE A — ACCEPT
Proceed to next state or next question.

## MODE B — CLARIFY
Ask 1 focused follow-up question.

## MODE C — CHALLENGE
Reframe vague or cliché input and re-ask.

---

# 7. CLICHÉ DETECTION

Flag and challenge:
- innovative
- trusted advisor
- client-focused
- end-to-end solutions
- best-in-class
- we think differently
- we deliver value

Convert into:
- observable behavior
- real example
- client experience
- concrete outcome

---

# 8. UI/UX REQUIREMENTS

## Must include:
- conversational interface (chat-style or hybrid chat/form)
- progressive question display
- AI response area
- input field (text + optional structured options)
- state indicator (optional but helpful)

## Must NOT include:
- multi-field static forms
- bulk question pages
- traditional survey layout

---

# 9. DATA SCHEMA

All inputs must map into:

```json
{
  "project_context": {},
  "audience": {},
  "perception": {},
  "competitive_landscape": {},
  "differentiation_signals": {},
  "evidence": {},
  "emotional_targets": {},
  "strategic_gaps": {},
  "hypotheses": {},
  "story_tool_payload": {}
}