export type ProjectBriefQuestionInputType = "text" | "textarea";

export interface ProjectBriefQuestion {
  id: string;
  label: string;
  shortLabel: string;
  inputType: ProjectBriefQuestionInputType;
  required: boolean;
  placeholder?: string;
  aiContextKey: string;
}

export interface ProjectBriefQuestionnaire {
  version: string;
  title: string;
  intro: string;
  questions: ProjectBriefQuestion[];
}

export const defaultProjectBriefQuestionnaire: ProjectBriefQuestionnaire = {
  version: "default-v1",
  title: "Create project brief",
  intro: "Our AI assistant will help you write a Project Overview",
  questions: [
    {
      id: "client_name",
      label: "What’s the name of the client company, org, entity or group?",
      shortLabel: "Client name",
      inputType: "text",
      required: true,
      placeholder: "Client, team, organization, or audience",
      aiContextKey: "client",
    },
    {
      id: "project_topic",
      label: "What is the project, initiative, or presentation about?",
      shortLabel: "Project topic",
      inputType: "textarea",
      required: true,
      placeholder: "Describe the work, decision, campaign, product, plan, or situation",
      aiContextKey: "topic",
    },
    {
      id: "current_situation",
      label: "What is happening right now that makes this project important?",
      shortLabel: "Current situation",
      inputType: "textarea",
      required: true,
      placeholder: "What changed, what is stuck, what needs attention?",
      aiContextKey: "currentSituation",
    },
    {
      id: "audience_need",
      label: "What does the audience or client need to understand, decide, or do?",
      shortLabel: "Audience need",
      inputType: "textarea",
      required: true,
      placeholder: "The action, agreement, clarity, or shift the presentation should create",
      aiContextKey: "audienceNeed",
    },
    {
      id: "challenge",
      label: "What is the main challenge, obstacle, or risk?",
      shortLabel: "Challenge",
      inputType: "textarea",
      required: true,
      placeholder: "Name the friction, uncertainty, tradeoff, or blocker",
      aiContextKey: "challenge",
    },
    {
      id: "success_outcome",
      label: "What does a successful outcome look like?",
      shortLabel: "Success outcome",
      inputType: "textarea",
      required: true,
      placeholder: "Describe the desired end state in practical terms",
      aiContextKey: "successOutcome",
    },
    {
      id: "extra_context",
      label: "Anything else the brief should include?",
      shortLabel: "Extra context",
      inputType: "textarea",
      required: false,
      placeholder: "Stakeholders, constraints, source material, tone, dates, or details",
      aiContextKey: "extraContext",
    },
  ],
};
