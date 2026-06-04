# STRATEGIC INTELLIGENCE INTAKE SYSTEM
## UI FLOW WIREFLOW SPEC (v1)

---

# 1. PRODUCT EXPERIENCE OVERVIEW

The system is a **conversational, AI-driven strategic intake interface**.

It behaves like:
- a guided interview
- a strategy co-pilot
- a thinking accelerator

NOT a form.

NOT a survey.

---

# 2. GLOBAL UI PRINCIPLES

- One primary question per screen
- Minimal UI clutter
- Progressive disclosure (only show what is needed)
- AI responds after every user input
- No static forms with multiple fields at once
- Conversation is the interface

---

# 3. GLOBAL AI LOOP (APPLIES TO ALL SCREENS)

After every user response:

1. AI evaluates response
2. AI selects mode:
   - ACCEPT
   - CLARIFY
   - CHALLENGE
3. AI outputs:
   - brief response (if needed)
   - next question
4. System advances to next screen state

---

# 4. ENTRY SCREEN

## SCREEN 0: START

### UI ELEMENTS
- Title: “Strategic Intake”
- Short description:
  “This will help structure your thinking for your client engagement.”
- Button: “Begin”

---

## AI BEHAVIOR
None

---

# 5. SCREEN FLOW

---

# SECTION 1 — PROJECT CONTEXT

---

## SCREEN 1.1 — PROJECT TYPE

### UI QUESTION
“What type of engagement is this?”

### OPTIONS
- Sales presentation (RFP / pitch)
- Leadership presentation
- Strategic campaign
- Other
- I’m not sure yet

### AI BEHAVIOR
MODE A (accept only)
No challenge allowed

---

## SCREEN 1.2 — PROJECT GOAL

### UI QUESTION
“What is the primary objective of this work?”

### INPUT TYPE
Free text

### AI BEHAVIOR
- MODE B or C allowed
- if vague → ask for clarification

---

## SCREEN 1.3 — SUCCESS METRICS

### UI QUESTION
“How will you define success?”

### INPUT TYPE
Free text

### AI BEHAVIOR
- challenge vague metrics (“better”, “stronger”, “impactful”)
- push toward observable outcomes

---

# SECTION 2 — AUDIENCE

---

## SCREEN 2.1 — PRIMARY AUDIENCE

### UI QUESTION
“Who is the primary audience you are trying to influence?”

### INPUT TYPE
Free text

### AI BEHAVIOR
- MODE B or C likely
- enforce specificity (roles, decision makers)

---

## SCREEN 2.2 — SECONDARY AUDIENCE

### UI QUESTION
“Are there secondary audiences or influencers we should consider?”

### INPUT TYPE
Free text

### AI BEHAVIOR
- accept partial answers
- prompt for missing stakeholders if needed

---

## SCREEN 2.3 — AUDIENCE PRESSURES

### UI QUESTION
“What pressures or challenges is this audience currently facing?”

### AI BEHAVIOR
- push away internal assumptions
- enforce external perspective

---

## SCREEN 2.4 — AUDIENCE EMOTIONAL NEEDS

### UI QUESTION
“What do they need to feel confident in choosing you?”

### AI BEHAVIOR
- convert generic answers into emotional drivers

---

# SECTION 3 — PERCEPTION

---

## SCREEN 3.1 — CURRENT PERCEPTION

### UI QUESTION
“How is your organization currently perceived by this audience?”

### AI BEHAVIOR
- challenge vague claims like “trusted advisor”
- ask for evidence if needed

---

## SCREEN 3.2 — PERCEPTION GAP

### UI QUESTION
“What do you believe they misunderstand or overlook about you?”

### AI BEHAVIOR
- probe for specificity and contradiction

---

## SCREEN 3.3 — DESIRED SHIFT

### UI QUESTION
“How do you want them to think about you after this engagement?”

### AI BEHAVIOR
- refine into transformation statement

---

# SECTION 4 — COMPETITION

---

## SCREEN 4.1 — DIRECT COMPETITORS

### UI QUESTION
“Who are your direct competitors in this situation?”

---

## SCREEN 4.2 — INDIRECT COMPETITORS

### UI QUESTION
“Who else are you competing with for attention or credibility?”

---

## SCREEN 4.3 — CATEGORY PATTERNS

### UI QUESTION
“What messaging do you typically see in your industry?”

### AI BEHAVIOR
- surface clichés explicitly
- compare against user input patterns

---

# SECTION 5 — DIFFERENTIATION

---

## SCREEN 5.1 — WHAT MAKES YOU DIFFERENT (CLAIMED)

### UI QUESTION
“What do you believe makes you different from competitors?”

### AI BEHAVIOR
- high cliché detection sensitivity
- challenge abstract claims immediately

---

## SCREEN 5.2 — HOW DIFFERENCE SHOWS UP (REALITY)

### UI QUESTION
“How does that difference actually show up in practice?”

### AI BEHAVIOR
- force examples
- convert claims → behavior

---

## SCREEN 5.3 — CLIENT EXPERIENCE

### UI QUESTION
“What is it like to work with you?”

---

# SECTION 6 — EVIDENCE

---

## SCREEN 6.1 — PROOF POINTS

### UI QUESTION
“What evidence supports your credibility?”

---

## SCREEN 6.2 — OUTCOMES

### UI QUESTION
“What results have you delivered that matter most here?”

---

# SECTION 7 — EMOTIONAL TARGETS

---

## SCREEN 7.1 — DESIRED FEELING

### UI QUESTION
“What do you want your audience to feel after seeing this?”

---

## SCREEN 7.2 — CURRENT EMOTION

### UI QUESTION
“How do they likely feel about you now?”

---

# SECTION 8 — SYNTHESIS

---

## SCREEN 8.1 — PERSUASIVE IDEA

### UI QUESTION
“If you had to make ONE persuasive point, what would it be?”

### AI BEHAVIOR
- aggressively challenge vagueness
- enforce clarity and specificity

---

## SCREEN 8.2 — TRUST REASON

### UI QUESTION
“Why should they believe you over competitors?”

---

# 6. AI BEHAVIOR RULES (GLOBAL)

At all times AI must:

- avoid multi-question overload
- prioritize clarity over speed
- challenge clichés directly but calmly
- translate internal language into audience reality
- increase rigor as flow progresses

---

# 7. FATIGUE CONTROL SYSTEM

If user shows fatigue signals:
- shorten responses
- reduce follow-ups
- switch to single-question mode
- avoid abstraction

---

# 8. STATE MODEL

Each screen produces structured data mapped to:

- project_context
- audience
- perception
- competition
- differentiation
- evidence
- emotional_targets
- synthesis

---

# 9. SYSTEM OUTPUT

At completion, system generates:

1. Structured JSON intake model
2. Human-readable Strategic Discovery Report
3. Optional Story Tool payload (if enabled)

---

# 10. CORE EXPERIENCE PRINCIPLE

This system is designed to:

> improve strategic clarity through guided conversation, not form completion

---