"use client";

import { ProjectSidebar } from "@/components/ProjectSidebar";
import { 
  SidebarProvider, 
  SidebarInset, 
  SidebarTrigger 
} from "@/components/ui/sidebar";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <ProjectSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center gap-2 px-4 border-b bg-background">
          <SidebarTrigger className="-ml-1" />
        </header>
        <main className="flex-1 p-4 lg:p-8 bg-muted/30 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
} 