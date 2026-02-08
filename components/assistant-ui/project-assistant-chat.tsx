"use client";

import type { ComponentProps } from "react";
import { useProject } from "@/components/providers/ProjectProvider";
import AssistantChat from "@/components/assistant-ui/assistant-chat";

type Props = Omit<ComponentProps<typeof AssistantChat>, "projectId" | "assistantName" | "assistantImageUrl" | "assistantPreset">;

export default function ProjectAssistantChat(props: Props) {
  const { project } = useProject();

  return (
    <AssistantChat
      projectId={project._id}
      assistantName={project.name}
      assistantImageUrl={project.imageUrl}
      assistantPreset={project.assistantPreset}
      {...props}
    />
  );
}
