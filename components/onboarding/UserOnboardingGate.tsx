"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";

import { apiAny } from "@/lib/convexApiAny";

const ONBOARDING_COMPLETED_STORAGE_PREFIX = "vibeplanner:user-onboarding-completed:";
const onboardingCompletionCache = new Map<string, boolean>();

function readCachedOnboardingCompletion(userId?: string): boolean {
  if (!userId) return false;

  const inMemory = onboardingCompletionCache.get(userId);
  if (typeof inMemory === "boolean") return inMemory;

  if (typeof window === "undefined") return false;

  const persisted = window.localStorage.getItem(`${ONBOARDING_COMPLETED_STORAGE_PREFIX}${userId}`) === "1";
  onboardingCompletionCache.set(userId, persisted);
  return persisted;
}

function persistCachedOnboardingCompletion(userId: string, completed: boolean) {
  onboardingCompletionCache.set(userId, completed);
  if (typeof window === "undefined") return;

  const key = `${ONBOARDING_COMPLETED_STORAGE_PREFIX}${userId}`;
  if (completed) {
    window.localStorage.setItem(key, "1");
  } else {
    window.localStorage.removeItem(key);
  }
}

export default function UserOnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const userId = user?.id;

  const completedFromCache = useMemo(() => readCachedOnboardingCompletion(userId), [userId]);

  const onboarding = useQuery(apiAny.users.getMyOnboardingProfile);
  const defaultProject = useQuery(apiAny.projects.getDefaultProjectForOnboarding);

  const isOnboardingRoute = pathname === "/onboarding";
  const completedFromServer = onboarding?.completed === true;
  const completed = onboarding === undefined || onboarding === null ? completedFromCache : completedFromServer;
  const needsOnboarding = onboarding ? onboarding.completed === false : onboarding === null;
  const hasAssistant = !!defaultProject;
  const shouldEnforceOnboarding = !completed && needsOnboarding && hasAssistant;

  useEffect(() => {
    if (!userId) return;
    if (onboarding?.completed === true) {
      persistCachedOnboardingCompletion(userId, true);
      return;
    }
    if (onboarding?.completed === false) {
      persistCachedOnboardingCompletion(userId, false);
    }
  }, [onboarding?.completed, userId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) return;
    if (defaultProject === undefined) return;
    if (isOnboardingRoute) return;
    if (shouldEnforceOnboarding) {
      router.replace("/onboarding");
    }
  }, [defaultProject, isLoaded, isOnboardingRoute, router, shouldEnforceOnboarding, user]);

  if (!isLoaded) return null;
  if (!user) return <>{children}</>;

  if (!isOnboardingRoute && onboarding === undefined && !completedFromCache) {
    return null;
  }
  if (!isOnboardingRoute && defaultProject === undefined && !completed) {
    return null;
  }

  if (!isOnboardingRoute && shouldEnforceOnboarding) {
    return null;
  }

  return <>{children}</>;
}
