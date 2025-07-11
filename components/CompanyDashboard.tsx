"use client";

import { useParams, useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";

import { ArrowLeft, FolderOpen, MapPin, DollarSign, Building2, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


function ProjectOverview({ tasks, projects }: { tasks: Doc<"tasks">[], projects: Doc<"projects">[] }) {
    const totalProjects = projects.length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === "done").length;
    const totalCost = tasks.reduce((sum, task) => sum + (task.cost || 0), 0);
  
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Aggregated cost of all tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProjects}</div>
              <p className="text-xs text-muted-foreground">Total number of projects in the team</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTasks}</div>
              <p className="text-xs text-muted-foreground">Across all projects</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedTasks}</div>
              <p className="text-xs text-muted-foreground">Of all tasks</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
}

export default function CompanyDashboard() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const { organization, isLoaded } = useOrganization();
  
  // Check if team exists first
  const team = useQuery(api.teams.getTeamBySlug, 
    params.slug ? { slug: params.slug } : "skip"
  );
  
  // Get projects for this organization
  const projects = useQuery(api.projects.listProjectsByClerkOrg, 
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );
  
  // Get team tasks for overview
  const teamTasks = useQuery(api.tasks.listTeamTasks, 
    team && team._id ? { teamId: team._id } : "skip"
  );

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Ładowanie...</div>;
  }

  if (!organization) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Organizacja nie znaleziona</h2>
        <p className="text-muted-foreground mb-4">
          Brak dostępu do tej organizacji lub nie jesteś jej członkiem.
        </p>
        <Button onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Powrót do strony głównej
        </Button>
      </div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <ProjectOverview 
        tasks={teamTasks || []} 
        projects={projects || []} 
      />

      {/* Recent Projects */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Projects</h2>
          <Button 
            onClick={() => router.push(`/${params.slug}/projects`)}
            variant="outline"
          >
            View All Projects
          </Button>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.slice(0, 6).map((project) => (
            <Card key={project._id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  
                </div>
                {project.description && (
                  <CardDescription className="line-clamp-2">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {project.client && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {project.client}
                    </div>
                  )}
                  {project.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {project.location}
                    </div>
                  )}
                </div>
                <Button 
                  className="w-full mt-4" 
                  variant="outline"
                  onClick={() => router.push(`/${params.slug}/${project.slug}`)}
                >
                  Open Project
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}