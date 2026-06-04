# STRATEGIC INTELLIGENCE INTAKE SYSTEM
## STATE MACHINE SPECIFICATION (v1)

---

# 1. PURPOSE

This file defines the canonical state progression for the Strategic Intelligence Intake System.

It ensures:
- deterministic flow structure
- consistent AI behavior across screens
- predictable data accumulation
- clean mapping between UI and schema

This system is a **linear progression with controlled conditional branching based on AI fatigue detection and answer quality**.

---

# 2. STATE OVERVIEW

The system consists of the following states:

1. START
2. PROJECT_CONTEXT
3. AUDIENCE
4. PERCEPTION
5. COMPETITION
6. DIFFERENTIATION
7. EVIDENCE
8. EMOTIONAL_TARGETS
9. STRATEGIC_SYNTHESIS
10. COMPLETE

---

# 3. STATE TRANSITION LOGIC

## DEFAULT FLOW (PRIMARY PATH)

START
  ↓
PROJECT_CONTEXT
  ↓
AUDIENCE
  ↓
PERCEPTION
  ↓
COMPETITION
  ↓
DIFFERENTIATION
  ↓
EVIDENCE
  ↓
EMOTIONAL_TARGETS
  ↓
STRATEGIC_SYNTHESIS
  ↓
COMPLETE

---

# 4. STATE DEFINITIONS

---

## STATE: START

### Purpose
Initialize session and collect minimal context.

### Outputs
- project type selection
- engagement type
- readiness confirmation

### Next State
PROJECT_CONTEXT

---

## STATE: PROJECT_CONTEXT

### Purpose
Define the engagement and its constraints.

### Data Collected
- project type
- objectives
- success criteria
- constraints
- stakeholders

### Transition Rule
Proceed when minimum viable context is collected.

---

## STATE: AUDIENCE

### Purpose
Define who the communication is targeting.

### Data Collected
- primary audience
- secondary audience
- decision roles
- audience pressures
- emotional drivers

---

## STATE: PERCEPTION

### Purpose
Establish how audience currently perceives the client.

### Data Collected
- current perception
- misconceptions
- evidence of perception
- desired shift

### Key Rule
Force external perspective (audience-first lens)

---

## STATE: COMPETITION

### Purpose
Define competitive and category context.

### Data Collected
- direct competitors
- indirect competitors
- category norms
- messaging patterns

---

## STATE: DIFFERENTIATION

### Purpose
Surface differentiation signals and test validity.

### Data Collected
- capabilities
- behavioral differentiation
- client experience
- belief systems

### Key Rule
Aggressively challenge clichés and vague claims

---

## STATE: EVIDENCE

### Purpose
Ground claims in proof.

### Data Collected
- case studies
- outcomes
- testimonials
- metrics
- missing proof gaps

---

## STATE: EMOTIONAL_TARGETS

### Purpose
Define emotional transformation goal.

### Data Collected
- desired audience feelings
- current emotional state
- emotional shift required
- trust dynamics

---

## STATE: STRATEGIC_SYNTHESIS

### Purpose
Force prioritization into a single persuasive direction.

### Data Collected
- primary persuasive idea
- trust justification
- narrative direction
- key tension

### Key Rule
No vague answers allowed. Must converge into clarity.

---

## STATE: COMPLETE

### Purpose
Finalize structured output.

### Outputs Generated
- structured JSON schema
- discovery report
- optional story tool payload

---

# 5. GLOBAL TRANSITION RULES

## RULE 1 — LINEAR DEFAULT
System must follow linear progression unless overridden by fatigue or clarification needs.

---

## RULE 2 — QUALITY GATES
A state cannot be exited unless minimum clarity threshold is met.

---

## RULE 3 — FATIGUE OVERRIDE
If user shows fatigue:
- reduce question complexity
- allow partial completion
- proceed with inferred structure

---

## RULE 4 — CLARIFICATION LOOP
If response is vague:
- remain in current state
- ask clarifying question only
- do not advance state

---

## RULE 5 — AI COACHING INTEGRATION
At every state:
- apply AI coaching engine rules
- enforce audience-first lens
- detect and challenge clichés

---

# 6. SYSTEM PRINCIPLE

This state machine ensures that strategic clarity is progressively constructed, not assumed.