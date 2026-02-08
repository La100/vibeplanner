import { ProjectSidebar } from "@/components/project/ProjectSidebar";
import { ProjectProvider } from "@/components/providers/ProjectProvider";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { Suspense } from "react";
import { OnboardingDialogWrapper } from "@/components/ai/OnboardingDialogWrapper";
import UserOnboardingGate from "@/components/onboarding/UserOnboardingGate";

function ProjectLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <OnboardingDialogWrapper />
      <ProjectSidebar />
      <SidebarInset>
        <header className="xl:hidden flex h-16 items-center gap-2 px-4 border-b bg-background">
          <SidebarTrigger className="-ml-1 [&.hidden]:flex" />
        </header>
        <main className="flex-1 min-h-0 overflow-auto p-4 xl:p-8">
          <Suspense fallback={
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded animate-pulse w-1/3" />
              <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </div>
          }>
            {children}
          </Suspense>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    projectSlug: string;
  }>;
}

export default async function ProjectLayout({
  children,
}: ProjectLayoutProps) {
  return (
    <Suspense fallback={
      <div className="flex h-screen">
        <div className="w-64 bg-muted animate-pulse" />
        <div className="flex-1 p-8">
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded animate-pulse w-1/3" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    }>
      <UserOnboardingGate>
        <ProjectProvider>
          <ProjectLayoutContent>{children}</ProjectLayoutContent>
        </ProjectProvider>
      </UserOnboardingGate>
    </Suspense>
  );
} 
