"use client";

import { CompanyNavbar } from "@/components/company/CompanyNavbar";
import UserOnboardingGate from "@/components/onboarding/UserOnboardingGate";

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserOnboardingGate>
      <div className="flex min-h-screen flex-col">
        <CompanyNavbar />
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </UserOnboardingGate>
  );
}
