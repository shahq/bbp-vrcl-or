import React from "react";
import type { ModelType } from "../../services/ai";
import ChatActionConfirmation from "./ChatActionConfirmation";
import ChatComposer from "./ChatComposer";
import ChatThread from "./ChatThread";
import ProjectBriefQuestionnaire from "./ProjectBriefQuestionnaire";
import { useChatPanel } from "./useChatPanel";
import type { ChatActionRequest, ChatPanelContext, ProjectBackgroundApplyMode } from "./types";

interface ChatPanelProps {
  context: ChatPanelContext;
  selectedModel: ModelType;
  pendingAction?: ChatActionRequest | null;
  onApplyProjectBackgroundDraft?: (text: string, mode: ProjectBackgroundApplyMode) => void;
  selectedContextLabel?: string;
}

export default function ChatPanel({ context, selectedModel, pendingAction, onApplyProjectBackgroundDraft, selectedContextLabel }: ChatPanelProps) {
  if (context.currentView === "new") {
    return (
      <div className="h-full">
        <ChatActionConfirmation action={pendingAction} />
        <ProjectBriefQuestionnaire
          context={context}
          selectedModel={selectedModel}
          onApplyProjectBackgroundDraft={onApplyProjectBackgroundDraft}
        />
      </div>
    );
  }

  const {
    messages,
    input,
    setInput,
    isTyping,
    handleSendMessage,
    emptyState,
  } = useChatPanel({ context, selectedModel, onApplyProjectBackgroundDraft });

  return (
    <div className="flex flex-col h-full">
      <ChatActionConfirmation action={pendingAction} />
      <ChatThread
        messages={messages}
        isTyping={isTyping}
        emptyState={emptyState}
        renderMessageActions={(message) => {
          if (
            !onApplyProjectBackgroundDraft ||
            context.currentView !== "new" ||
            message.role !== "model" ||
            !message.projectBackgroundDraft?.trim()
          ) {
            return null;
          }

          const hasExistingBackground = !!context.projectData.background.trim();

          return (
            <div className="mt-2 flex justify-start gap-2">
              <button
                onClick={() => onApplyProjectBackgroundDraft(message.projectBackgroundDraft!, "replace")}
                className="px-3 py-1.5 rounded-md bg-white border border-indigo-200 text-indigo-700 text-sm font-medium hover:bg-indigo-50 transition-colors shadow-sm"
              >
                {hasExistingBackground ? "Replace project background" : "Use as project background"}
              </button>
              {hasExistingBackground && (
                <button
                  onClick={() => onApplyProjectBackgroundDraft(message.projectBackgroundDraft!, "append")}
                  className="px-3 py-1.5 rounded-md bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Append to project background
                </button>
              )}
            </div>
          );
        }}
      />
      <ChatComposer
        input={input}
        setInput={setInput}
        onSend={handleSendMessage}
        isTyping={isTyping}
        showStarter={false}
        starterLabel=""
        onStarter={() => {}}
        selectedContextLabel={selectedContextLabel}
      />
    </div>
  );
}
