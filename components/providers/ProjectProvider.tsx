"use client";

import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

interface ProjectContextType {
  project: Doc<"projects">;
  team: Doc<"teams"> | null;
  permissions: {
    permissions?: {
      overview?: { visible: boolean };
      tasks?: { visible: boolean };
      surveys?: { visible: boolean };
      calendar?: { visible: boolean };
      gantt?: { visible: boolean };
      files?: { visible: boolean };
      shopping_list?: { visible: boolean };
      settings?: { visible: boolean };
    };
  } | null;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { 
  children: ReactNode; 
}) {
  const params = useParams<{ slug: string; projectSlug: string }>();
  
  // Simple regular query approach
  const project = useQuery(
    api.projects.getProjectBySlug,
    params.slug && params.projectSlug
      ? { teamSlug: params.slug, projectSlug: params.projectSlug }
      : "skip"
  );
  
  const team = useQuery(api.teams.getTeam, 
    project ? { teamId: project.teamId } : "skip"
  );
  
  const permissions = useQuery(api.projects.getProjectSidebarPermissions, 
    project ? { projectId: project._id } : "skip"
  );

  const isLoading = !project || !team || !permissions;

  const value: ProjectContextType = {
    project: project!,
    team: team || null,
    permissions: permissions || null,
    isLoading,
  };

  // Don't render children until we have the basic project data
  if (!project) {
    return <div className="flex items-center justify-center p-8">Loading project...</div>;
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