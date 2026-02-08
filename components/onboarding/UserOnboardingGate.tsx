"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";

import { apiAny } from "@/lib/convexApiAny";

export default function UserOnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoaded } = useUser();

  const onboarding = useQuery(apiAny.users.getMyOnboardingProfile);

  const isOnboardingRoute = pathname === "/onboarding";
  const completed = onboarding?.completed === true;
  const needsOnboarding = onboarding ? onboarding.completed === false : onboarding === null;

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) return;
    if (isOnboardingRoute) return;
    if (needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [isLoaded, isOnboardingRoute, needsOnboarding, router, user]);

  if (!isLoaded) return null;
  if (!user) return <>{children}</>;

  if (!isOnboardingRoute && onboarding === undefined) {
    return null;
  }

  if (!isOnboardingRoute && needsOnboarding && !completed) {
    return null;
  }

  return <>{children}</>;
}
