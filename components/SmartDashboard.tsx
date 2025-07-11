"use client";

import { useOrganizationList, useOrganization } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, Users, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";


export function SmartDashboard() {
  const { userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { organization } = useOrganization();

  const organizations = userMemberships?.data?.map(membership => ({
    id: membership.organization.id,
    name: membership.organization.name,
    role: membership.role
  })) || [];

  // Auto-select the organization if user has only one
  // Note: This logic is handled by the UI flow instead

  // Show projects directly if user has one organization
  if (organizations.length === 1 && organization) {
    return <SingleOrgDashboard organization={organization} />;
  }

  // Show organization selector if multiple organizations
  if (organizations.length > 1) {
    return <MultiOrgDashboard organizations={organizations} />;
  }

  // No organizations - show create prompt
  return <NoOrgDashboard />;
}

function SingleOrgDashboard({ organization }: { organization: { id: string; name: string; membersCount: number } }) {
  const router = useRouter();
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  
  // Sync team with Clerk organization
  const syncTeam = useMutation(api.teams.syncTeamWithClerkOrg);
  
  // Check if team exists first
  const team = useQuery(api.teams.getTeamByClerkOrg, 
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );
  
  // Get projects for this organization
  const projects = useQuery(api.projects.listProjectsByClerkOrg, 
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );
  
  const createProject = useMutation(api.projects.createProjectInOrg);
  
  // Auto-sync organization when it loads
  useEffect(() => {
    if (organization?.id && organization?.name && team === null) {
      syncTeam({
        clerkOrgId: organization.id,
        orgName: organization.name,
      }).catch(() => {});
    }
  }, [organization?.id, organization?.name, team, syncTeam]);

  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    client: "",
    location: "",
    budget: "",
    startDate: "",
  });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!team?._id) {
      console.error("Team not available");
      return;
    }
    
    try {
      const projectId = await createProject({
        name: newProject.name,
        description: newProject.description,
        clerkOrgId: organization.id,
        teamId: team._id,
        client: newProject.client,
        location: newProject.location,
        budget: newProject.budget ? parseInt(newProject.budget) : undefined,
        startDate: newProject.startDate ? new Date(newProject.startDate).getTime() : undefined,
        endDate: undefined,
      });

      setShowNewProjectForm(false);
      setNewProject({
        name: "",
        description: "",
        client: "",
        location: "",
        budget: "",
        startDate: "",
      });

      router.push(`/project/${projectId}`);
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{organization.name}</h2>
          <p className="text-muted-foreground">Zarządzaj projektami architektonicznymi</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {organization.membersCount || 0} członków
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <FolderOpen className="h-3 w-3" />
            {projects?.length || 0} projektów
          </Badge>
          {team === null && (
            <Badge variant="outline" className="flex items-center gap-1">
              <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
              Synchronizuję...
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Projekty</h3>
          <p className="text-muted-foreground">Lista aktualnych projektów architektonicznych</p>
        </div>
        
        <Dialog open={showNewProjectForm} onOpenChange={setShowNewProjectForm}>
          <DialogTrigger asChild>
            <Button disabled={!team?._id}>
              <Plus className="mr-2 h-4 w-4" />
              Nowy projekt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nowy projekt</DialogTitle>
              <DialogDescription>
                Utwórz nowy projekt architektoniczny dla zespołu {organization.name}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nazwa projektu *</Label>
                  <Input
                    id="name"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    required
                  />
                </div>
                
                

                <div className="space-y-2">
                  <Label htmlFor="client">Klient</Label>
                  <Input
                    id="client"
                    value={newProject.client}
                    onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Lokalizacja</Label>
                  <Input
                    id="location"
                    value={newProject.location}
                    onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">Budżet (PLN)</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={newProject.budget}
                    onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Data rozpoczęcia</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={newProject.startDate}
                    onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Opis</Label>
                <Textarea
                  id="description"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewProjectForm(false)}
                >
                  Anuluj
                </Button>
                <Button type="submit">
                  Utwórz projekt
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects?.map((project) => (
          <ProjectCard
            key={project._id}
            project={{...project, taskCount: 0, completedTasks: 0}}
            onClick={() => router.push(`/${team?.slug}/${project.slug}`)}
          />
        ))}
        
        {(!projects || projects.length === 0) && (
           <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Brak projektów</CardTitle>
              <CardDescription className="text-center mb-4">
                Utwórz pierwszy projekt, aby rozpocząć pracę.
              </CardDescription>
              <Button onClick={() => setShowNewProjectForm(true)} disabled={!team?._id}>
                <Plus className="mr-2 h-4 w-4" />
                Nowy projekt
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MultiOrgDashboard({ organizations }: { organizations: { id: string; name: string; role: string }[] }) {
  const { setActive } = useOrganizationList();

  if (!setActive) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Wybierz organizację</h2>
      <p className="text-muted-foreground">
        Jesteś członkiem wielu organizacji. Wybierz jedną, aby kontynuować.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map(org => (
          <Card 
            key={org.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActive({ organization: org.id })}
          >
            <CardHeader>
              <CardTitle>{org.name}</CardTitle>
              <CardDescription>Rola: {org.role}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-muted-foreground">
              <span>Przejdź do organizacji</span>
              <ArrowRight className="h-4 w-4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function NoOrgDashboard() {
  const { createOrganization } = useOrganizationList();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Witaj w VibePlanner!</CardTitle>
        <CardDescription>
          Wygląda na to, że nie należysz do żadnej organizacji.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4">
          Aby rozpocząć, utwórz nową organizację dla swojego zespołu.
        </p>
        <Button onClick={() => createOrganization ? createOrganization({name: "My Organization"}) : null}>
          <Plus className="mr-2 h-4 w-4" />
          Utwórz organizację
        </Button>
      </CardContent>
    </Card>
  )
}

function ProjectCard({ project, onClick }: { 
  project: {
    _id: string;
    name: string;
    description?: string;
    client?: string;
    location?: string;
    budget?: number;
    taskCount: number;
    completedTasks: number;
  }; 
  onClick: () => void 
}) {
  const progress = project.taskCount > 0 ? (project.completedTasks / project.taskCount) * 100 : 0;

  return (
    <Card onClick={onClick} className="cursor-pointer hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{project.name}</CardTitle>
        </div>
        <CardDescription>{project.description || 'No description'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
            {project.client && (
              <div className="flex items-center">
                <Building2 className="mr-2 h-4 w-4" />
                <span>{project.client}</span>
              </div>
            )}
            {project.location && (
              <div className="flex items-center">
                <Users className="mr-2 h-4 w-4" />
                <span>{project.location}</span>
              </div>
            )}
            {project.budget && (
                <div className="flex items-center">
                    <span className="font-semibold">${project.budget.toLocaleString()}</span>
                </div>
            )}
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">{project.completedTasks}/{project.taskCount} tasks</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2.5">
            <div 
              className="bg-primary h-2.5 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}