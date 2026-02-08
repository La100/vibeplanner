"use client";

import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Doc } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { Building } from "lucide-react";

interface ProjectContextType {
  project: Doc<"projects">;
  team: Doc<"teams"> | null;
  permissions: null;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { 
  children: ReactNode; 
}) {
  const params = useParams<{ projectSlug: string }>();
  const project = useQuery(
    apiAny.projects.getProjectBySlugForCurrentUser,
    params.projectSlug ? { projectSlug: params.projectSlug } : "skip"
  );
  
  const team = useQuery(apiAny.teams.getTeam, 
    project ? { teamId: project.teamId } : "skip"
  );
  
  const isLoading = !project || !team;

  const value: ProjectContextType = {
    project: project!,
    team: team || null,
    permissions: null,
    isLoading,
  };

  // Don't render children until we have the basic project data
  if (!project) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Building className="h-8 w-8 text-black animate-pulse" />
            <span className="text-2xl font-semibold text-black">VibePlanner</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-foreground rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider');
  }
  return context;
}
