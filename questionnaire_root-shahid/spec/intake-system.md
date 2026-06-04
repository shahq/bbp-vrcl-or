# STRATEGIC INTELLIGENCE INTAKE SYSTEM (v1)

## SYSTEM OVERVIEW

The Strategic Intelligence Intake System is an AI-driven strategic discovery engine designed to extract, structure, and refine thinking for high-stakes persuasive communications (RFPs, sales presentations, leadership presentations, and strategic campaigns).

It is NOT a form or survey.

It is a guided intelligence system that improves the quality of client thinking in real time.

---

## USERS

- Consulting firms (BDO → Deloitte scale)
- Pursuit teams (RFP / sales enablement)
- Senior leadership stakeholders
- Internal marketing and strategy teams

---

## SYSTEM MODES

1. Client-led intake
2. Client → Story Tool pipeline
3. Internal proxy completion
4. Hybrid iterative use

---

## SYSTEM ARCHITECTURE

- Questionnaire Engine (interaction layer)
- AI Coaching Engine (real-time reasoning behavior)
- Structured Output Schema (data model)
- Story Tool Payload (optional downstream output)

---

# QUESTION FLOW ARCHITECTURE

## Phase 1 — Orientation
- Project context
- Objectives
- Basic audience identification

## Phase 2 — Context Expansion
- Stakeholders
- Competitors
- Constraints
- Timing

## Phase 3 — Perception Layer
- Audience perception
- Misconceptions
- Assumptions
- Reputation signals

## Phase 4 — Differentiation & Evidence
- Capabilities vs competitors
- Experience signals
- Proof points
- Behavioral differentiation

## Phase 5 — Strategic Synthesis
- Persuasive hypothesis
- Emotional targets
- Perception shift
- Strategic prioritization

---

## FLOW RULES

- Do not jump phases prematurely
- Increase abstraction gradually
- Reduce cognitive load early
- Increase specificity requirements later
- Maintain continuity across sections
- Slow down if fatigue is detected

---

# AI COACHING ENGINE

## ROLE

The AI is a strategic discovery assistant that improves thinking quality.

It does NOT:
- generate final strategy
- write marketing copy
- assume correctness of input

It DOES:
- challenge vague thinking
- detect clichés
- force specificity
- convert claims into observable reality
- reframe weak thinking

---

## RESPONSE MODES

### MODE A — ACCEPT
Use when input is:
- specific
- grounded
- evidence-based

Action: proceed

---

### MODE B — CLARIFY
Use when input is:
- partially useful
- vague or incomplete

Action:
- ask 1 focused question
- optionally include example

---

### MODE C — CHALLENGE
Use when input is:
- generic
- cliché-driven
- abstract

Action:
- reframe question
- request specificity
- re-ask

---

## CLICHÉ DETECTION

Flag:
- innovative
- trusted advisor
- client-focused
- end-to-end solutions
- best-in-class
- we think differently
- we deliver value

Always convert to:
- example
- behavior
- experience
- observable outcome

---

## AUDIENCE-FIRST RULE

Always translate internal claims into:

> What does the audience actually experience, believe, or observe?

---

# QUESTIONNAIRE STRUCTURE

## 1. PROJECT CONTEXT
- project type
- objectives
- stakeholders
- constraints
- success metrics
- risks

## 2. AUDIENCE
- primary audience
- secondary audience
- decision structure
- pressures
- emotional needs
- objections
- trust drivers

## 3. PERCEPTION
- current perception
- misconceptions
- evidence of perception
- desired shift

## 4. COMPETITION
- direct competitors
- indirect competitors
- category norms
- messaging patterns

## 5. DIFFERENTIATION SIGNALS
- capabilities
- experience
- behaviors
- beliefs
- emerging themes

## 6. EVIDENCE
- case studies
- outcomes
- proof points
- missing proof

## 7. EMOTIONAL TARGETS
- desired feelings
- current emotional state
- emotional shift
- trust dynamics

## 8. STRATEGIC GAPS
- unclear insights
- weak differentiation
- missing proof
- stakeholder risks
- clichés detected

## 9. HYPOTHESES (AI GENERATED)
- positioning directions
- narrative angles
- hooks
- tensions
- unverified assumptions

## 10. STORY TOOL PAYLOAD (OPTIONAL OUTPUT)
- audience tensions
- narrative inputs
- proof architecture
- language patterns

---

# STRUCTURED OUTPUT SCHEMA

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