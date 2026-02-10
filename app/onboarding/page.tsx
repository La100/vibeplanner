"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";

import UserOnboardingChat from "@/components/assistant-ui/user-onboarding-chat";
import { apiAny } from "@/lib/convexApiAny";

export default function UserOnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const ensureMyTeam = useMutation(apiAny.teams.ensureMyTeam);
  const ensuredRef = useRef(false);

  const onboarding = useQuery(apiAny.users.getMyOnboardingProfile);
  const defaultProject = useQuery(apiAny.projects.getDefaultProjectForOnboarding);

  const completed = onboarding?.completed === true;

  // Ensure team + projects exist (may not have been created yet by webhook)
  useEffect(() => {
    if (!isLoaded || !user || ensuredRef.current) return;
    ensuredRef.current = true;
    ensureMyTeam({}).catch(console.error);
  }, [isLoaded, user, ensureMyTeam]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) return;
    if (completed) {
      router.replace("/dashboard");
    }
  }, [completed, isLoaded, router, user]);

  const projectId = defaultProject?._id;

  const assistantPreset = useMemo(() => defaultProject?.assistantPreset, [defaultProject?.assistantPreset]);

  if (!isLoaded || !user) {
    return null;
  }

  if (completed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-10 flex flex-col gap-5">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            User Profile
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Quick Onboarding
          </h1>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground">
            Answer a few questions so assistants can personalize how they work and communicate with you.
          </p>
        </header>

        <div className="h-[min(74vh,760px)] min-h-[480px] sm:min-h-[560px] overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          {onboarding === null ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Finalizing your account setup...
            </div>
          ) : projectId ? (
            <UserOnboardingChat
              projectId={projectId}
              assistantPreset={assistantPreset}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Preparing onboarding...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
