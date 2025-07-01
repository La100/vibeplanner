"use client";

import { ProjectSidebar } from "@/components/ProjectSidebar";
import { 
  SidebarProvider, 
  SidebarInset, 
  SidebarTrigger 
} from "@/components/ui/sidebar";
import { Suspense } from "react";

function ProjectLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ProjectSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center gap-2 px-4 border-b bg-background">
          <SidebarTrigger className="-ml-1" />
        </header>
        <main className="flex-1 p-4 lg:p-8 bg-muted/30 overflow-auto">
          <Suspense fallback={
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded animate-pulse w-1/3" />
              <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
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

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className="flex h-screen">
        <div className="w-64 bg-muted animate-pulse" />
        <div className="flex-1 flex flex-col">
          <div className="h-16 bg-muted animate-pulse border-b" />
          <div className="flex-1 p-8">
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded animate-pulse w-1/3" />
              <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <ProjectLayoutContent>{children}</ProjectLayoutContent>
    </Suspense>
  );
} 