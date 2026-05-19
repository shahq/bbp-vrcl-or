import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { defaultProjectBriefQuestionnaire } from "../../config/projectBriefQuestionnaire";
import { generateProjectOverviewFromQuestionnaire, type ModelType } from "../../services/ai";
import type { ChatPanelContext, ProjectBackgroundApplyMode } from "./types";

interface ProjectBriefQuestionnaireProps {
  context: ChatPanelContext;
  selectedModel: ModelType;
  onApplyProjectBackgroundDraft?: (text: string, mode: ProjectBackgroundApplyMode) => void;
}

export default function ProjectBriefQuestionnaire({
  context,
  selectedModel,
  onApplyProjectBackgroundDraft,
}: ProjectBriefQuestionnaireProps) {
  const questionnaire = defaultProjectBriefQuestionnaire;
  const [hasStarted, setHasStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({
    client_name: context.projectData.client || context.currentSession?.name || "",
  }));
  const [generatedDraft, setGeneratedDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = questionnaire.questions[currentIndex];
  const currentAnswer = answers[currentQuestion.id] || "";
  const totalQuestions = questionnaire.questions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const canAdvance = !currentQuestion.required || currentAnswer.trim().length > 0;
  const answeredRequiredCount = useMemo(
    () => questionnaire.questions.filter((question) => answers[question.id]?.trim()).length,
    [answers, questionnaire.questions]
  );

  const updateCurrentAnswer = (value: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    setError(null);
  };

  const goNext = async () => {
    if (!canAdvance) {
      setError("Please answer this question before continuing.");
      return;
    }

    if (!isLastQuestion) {
      setCurrentIndex((index) => index + 1);
      setError(null);
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const draft = await generateProjectOverviewFromQuestionnaire(
        questionnaire,
        answers,
        context.projectData.background,
        context.projectData.notes,
        selectedModel
      );
      setGeneratedDraft(draft);
    } catch (generationError: any) {
      setError(generationError?.message || "Could not generate the project overview. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const applyDraft = () => {
    if (!generatedDraft.trim() || !onApplyProjectBackgroundDraft) return;
    onApplyProjectBackgroundDraft(generatedDraft, context.projectData.background.trim() ? "replace" : "replace");
  };

  if (!hasStarted) {
    return (
      <div className="flex h-full flex-col justify-center bg-slate-100 px-8">
        <div className="mx-auto w-full max-w-md text-center">
          <p className="mb-5 text-sm leading-relaxed text-gray-900">{questionnaire.intro}</p>
          <button
            onClick={() => setHasStarted(true)}
            className="w-full border border-gray-400 bg-white px-4 py-3 text-sm font-bold text-gray-900 shadow-sm transition-colors hover:bg-gray-50"
          >
            Start Questions
          </button>
        </div>
      </div>
    );
  }

  if (generatedDraft) {
    return (
      <div className="flex h-full flex-col bg-slate-100">
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Project overview draft</div>
          <div className="mt-1 text-xs text-gray-700">
            Review the generated brief, then apply it to the Project Overview field.
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-4 text-xs leading-5 text-gray-800 shadow-sm">
            {generatedDraft}
          </div>
        </div>
        <div className="border-t border-gray-200 bg-white p-4">
          {onApplyProjectBackgroundDraft ? (
            <button
              onClick={applyDraft}
              className="flex w-full items-center justify-center gap-2 bg-gray-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-black"
            >
              <Check size={18} />
              Use as Project Overview
            </button>
          ) : (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Project overview editing is not available in this view.
            </div>
          )}
          <button
            onClick={() => setGeneratedDraft("")}
            className="mt-2 w-full px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Back to answers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-100">
      <div className="flex-1 overflow-y-auto px-8 py-14">
        <div className="mx-auto max-w-xl">
          <div className="mb-5 text-[10px] font-bold uppercase tracking-wide text-gray-700">
            Questions
          </div>
          <div className="mb-2 text-sm text-gray-900">
            Hi {context.projectData.client || context.currentSession?.name || "there"},
          </div>
          <label className="block text-base font-medium leading-snug text-gray-950">
            Q{currentIndex + 1}: {currentQuestion.label}
          </label>

          <div className="mt-5">
            {currentQuestion.inputType === "textarea" ? (
              <div className="flex items-end rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-md focus-within:border-gray-400 focus-within:ring-4 focus-within:ring-gray-200">
                <textarea
                  value={currentAnswer}
                  onChange={(event) => updateCurrentAnswer(event.target.value)}
                  placeholder={currentQuestion.placeholder}
                  className="min-h-24 min-w-0 flex-1 resize-none bg-transparent pr-3 text-sm text-gray-900 outline-none"
                  autoFocus
                />
                <button
                  onClick={goNext}
                  disabled={!canAdvance || isGenerating}
                  className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900 transition hover:bg-gray-200 disabled:opacity-40"
                  title={isLastQuestion ? "Generate overview" : "Next question"}
                >
                  {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                </button>
              </div>
            ) : (
              <div className="flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 shadow-md focus-within:border-gray-400 focus-within:ring-4 focus-within:ring-gray-200">
                <input
                  value={currentAnswer}
                  onChange={(event) => updateCurrentAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void goNext();
                  }}
                  placeholder={currentQuestion.placeholder}
                  className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none"
                  autoFocus
                />
                <button
                  onClick={goNext}
                  disabled={!canAdvance || isGenerating}
                  className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900 transition hover:bg-gray-200 disabled:opacity-40"
                  title={isLastQuestion ? "Generate overview" : "Next question"}
                >
                  {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                </button>
              </div>
            )}
          </div>

          {error && <div className="mt-4 text-sm font-medium text-red-600">{error}</div>}
          <div className="mt-5 text-sm text-gray-500">
            Question {currentIndex + 1} of {totalQuestions}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {answeredRequiredCount} of {totalQuestions} answered
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-gray-200 bg-white p-4">
        <button
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          disabled={currentIndex === 0 || isGenerating}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="ml-auto flex items-center gap-2 text-xs font-medium text-gray-500">
          {isGenerating ? (
            <>
              Generating <Loader2 size={14} className="animate-spin" />
            </>
          ) : isLastQuestion ? (
            <>
              Answer field arrow generates overview <Sparkles size={14} />
            </>
          ) : (
            <>
              Use the arrow in the answer field <ArrowRight size={14} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
