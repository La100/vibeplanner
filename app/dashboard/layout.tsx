"use client";

import type { ReactNode } from "react";
import UserOnboardingGate from "@/components/onboarding/UserOnboardingGate";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <UserOnboardingGate>{children}</UserOnboardingGate>;
}

