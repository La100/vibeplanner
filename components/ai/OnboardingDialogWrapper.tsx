"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/components/providers/ProjectProvider";
import ProjectAssistantChat from "@/components/assistant-ui/project-assistant-chat";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";

type PresetId = "gymbro" | "custom" | "monk" | "marcus";

/**
 * Health Assistant onboarding wrapper.
 *
 * We intentionally skip the preset selection UI and always run the Health Assistant
 * when assistantOnboarding is pending.
 */
export function OnboardingDialogWrapper() {
  const { project, isLoading } = useProject();

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const completeOnboarding = useMutation(apiAny.projects.completeOnboarding);
  const presetId = (project?.assistantPreset ?? "custom") as PresetId;
  const channels = useQuery(
    apiAny.messaging.channels.listChannelsForProject,
    project ? { projectId: project._id } : "skip"
  );

  useEffect(() => {
    if (isLoading || !project) return;

    const onboardingStatus = project.assistantOnboarding?.status;
    if (onboardingStatus === "pending") {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, [project, isLoading]);

  const intro = "[SYSTEM: START_ONBOARDING]";

  const handleFinish = async () => {
    if (!project) return;

    const telegramConfigured = !!project.telegramBotToken && !!project.telegramBotUsername;
    const hasActiveTelegramChannel =
      Array.isArray(channels) &&
      channels.some((c) => c.platform === "telegram" && c.isActive);

    if (!telegramConfigured || !hasActiveTelegramChannel) {
      const ok = window.confirm(
        "Telegram isn’t connected yet. Finish setup anyway? You can connect Telegram later in Project settings."
      );
      if (!ok) return;
    }

    setIsFinishing(true);
    try {
      // Habits are created by the AI during onboarding conversation —
      // no need to seed defaults (that caused duplicates).
      await completeOnboarding({ projectId: project._id });
      // The wrapper will auto-close when project updates
    } finally {
      setIsFinishing(false);
    }
  };

  if (!showOnboarding) return null;

  return (
    <div className="fixed inset-0 z-[50] bg-background flex flex-col animate-in fade-in duration-300">
      <div className="container max-w-5xl mx-auto h-full py-6 sm:py-8 px-4 flex flex-col">
        <header className="mb-4 sm:mb-6 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            {presetId === "gymbro"
              ? "Gym Bro Setup"
              : presetId === "monk"
                ? "Monk Onboarding"
              : presetId === "marcus"
                ? "Marcus Aurelius Onboarding"
              : "Assistant Onboarding"}
          </h1>
          <p className="text-muted-foreground">
            {presetId === "gymbro"
              ? "Answer a few questions and I’ll build your training plan."
              : presetId === "monk"
                ? "Answer a few questions and I’ll set up a simple daily mindfulness practice."
              : presetId === "marcus"
                ? "Answer a few questions and I’ll help you build a calm, disciplined plan."
              : "Answer a few questions to define your focus and habits."}
          </p>
        </header>

        <div className="flex-1 overflow-hidden border rounded-xl shadow-lg bg-card">
          <ProjectAssistantChat className="h-full" intro={intro} showHeader={false} threadKind="assistant_onboarding" />
        </div>

        <div className="mt-3 sm:mt-4 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
          <p>When the assistant finishes, onboarding should close automatically.</p>
          <p className="text-xs text-muted-foreground/80">
            If it doesn’t, you can finish manually:
          </p>
          <Button
            variant="secondary"
            onClick={handleFinish}
            disabled={isFinishing}
            className="w-full sm:w-auto"
          >
            {isFinishing ? "Finishing…" : "Finish setup"}
          </Button>
        </div>
      </div>
    </div>
  );
}
