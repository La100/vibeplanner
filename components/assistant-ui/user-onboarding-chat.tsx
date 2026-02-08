"use client";

import type { ComponentProps } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import AssistantChat from "@/components/assistant-ui/assistant-chat";

const INTRO = "[SYSTEM: START_USER_PROFILE_ONBOARDING]";

type Props = Omit<
  ComponentProps<typeof AssistantChat>,
  "intro" | "threadKind" | "showHeader" | "assistantName" | "assistantImageUrl" | "projectId"
> & {
  projectId: Id<"projects">;
  assistantPreset?: string;
};

export default function UserOnboardingChat({ projectId, assistantPreset, className, ...props }: Props) {
  return (
    <AssistantChat
      projectId={projectId}
      intro={INTRO}
      threadKind="user_onboarding"
      showHeader={false}
      assistantName="VibePlanner"
      assistantPreset={assistantPreset}
      className={[
        "h-full min-h-0",
        "[&_.aui-thread-root]:bg-card",
        "[&_.aui-thread-viewport]:px-3 sm:[&_.aui-thread-viewport]:px-5",
        "[&_.aui-thread-composer-footer]:bg-card",
        "[&_.aui-thread-composer-footer]:px-3 sm:[&_.aui-thread-composer-footer]:px-5",
        "[&_.aui-composer-attachment-dropzone]:rounded-xl",
        "[&_.aui-composer-attachment-dropzone]:border-border",
        "[&_.aui-composer-attachment-dropzone]:bg-background/90",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

