"use client";

import type { ComponentProps } from "react";
import { useProject } from "@/components/providers/ProjectProvider";
import AssistantChat from "@/components/assistant-ui/assistant-chat";
import { resolveAssistantImageUrl } from "@/lib/assistantImage";

type Props = Omit<ComponentProps<typeof AssistantChat>, "projectId" | "assistantName" | "assistantImageUrl" | "assistantPreset">;

export default function ProjectAssistantChat(props: Props) {
  const { project } = useProject();
  const assistantImageUrl = resolveAssistantImageUrl({
    imageUrl: project.imageUrl,
    assistantPreset: project.assistantPreset,
  });

  return (
    <AssistantChat
      projectId={project._id}
      assistantName={project.name}
      assistantImageUrl={assistantImageUrl}
      assistantPreset={project.assistantPreset}
      {...props}
    />
  );
}
