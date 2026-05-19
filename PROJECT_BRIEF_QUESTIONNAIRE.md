# Project Brief Questionnaire

The Create Project Brief page uses a deterministic questionnaire before calling AI.

## Current Flow

1. The user opens the Project Brief page.
2. The right panel shows a fixed multi-step questionnaire.
3. The app collects answers locally in the browser.
4. When the final question is submitted, the app sends the structured answers to the AI provider.
5. The AI returns a coherent Project Overview draft.
6. The user applies the draft to the Project Overview field, reviews it, and saves the session.

AI does not decide which question to ask next. The app owns question order, required fields, progress, and navigation.

## Where To Edit Questions

The default questionnaire lives here:

```text
src/config/projectBriefQuestionnaire.ts
```

Each question has this shape:

```ts
{
  id: "client_name",
  label: "What’s the name of the client company, org, entity or group?",
  shortLabel: "Client name",
  inputType: "text",
  required: true,
  placeholder: "Client, team, organization, or audience",
  aiContextKey: "client",
}
```

Field guidance:

- `id`: Stable storage key. Do not rename lightly after sessions depend on it.
- `label`: Full question shown to the user.
- `shortLabel`: Compact label passed into the AI context.
- `inputType`: `text` or `textarea`.
- `required`: Whether the user must answer before continuing.
- `placeholder`: Optional input hint.
- `aiContextKey`: Semantic key that tells the AI what the answer means.

## AI Handoff

The synthesis function is:

```text
src/services/ai.ts
generateProjectOverviewFromQuestionnaire(...)
```

It receives:

- questionnaire version and question definitions
- structured answers by question id
- existing Project Overview text
- additional notes
- selected AI model

It returns plain Project Overview prose only. The generated text is not saved automatically; it is applied to the editable field first so the user can review it.

## Future Owner-Editable Provider

The current questionnaire is static config for simplicity and handoff clarity. If the page owner needs no-code editing, add a provider seam instead of hardcoding UI-specific fetch logic.

Recommended shape:

```ts
interface ProjectBriefQuestionnaireProvider {
  getQuestionnaire(sessionId?: string): Promise<ProjectBriefQuestionnaire>;
}
```

Initial adapters:

- `staticQuestionnaireProvider`: reads `defaultProjectBriefQuestionnaire`
- `firestoreQuestionnaireProvider`: reads a client-owned questionnaire document
- `cmsQuestionnaireProvider`: reads from a CMS if the customer introduces one later

Keep product logic dependent on the provider interface, not on Firestore, CMS, or a specific vendor API.
