"use client";

import { useOrganizationList, useUser, useClerk } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, Users, Building2, Sparkles, Palette, Settings, HelpCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


export function SmartDashboard() {
  const router = useRouter();
  const { userMemberships, setActive, isLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const organizations = userMemberships?.data?.map(membership => ({
    id: membership.organization.id,
    name: membership.organization.name,
    slug: membership.organization.slug,
    role: membership.role
  })) || [];

  // Auto-redirect if user has exactly one organization
  useEffect(() => {
    if (!isLoaded) return;

    if (organizations.length >= 1) {
      // Always take the first organization
      const org = organizations[0];
      console.log("Redirecting to organization:", org);
      // Always redirect to the organization's URL
      setActive?.({ organization: org.id }).then(() => {
        console.log("Organization set, pushing to:", `/${org.slug}`);
        router.push(`/${org.slug}`);
      });
    }
  }, [isLoaded, organizations.length, setActive, router, organizations]);

  // Show loading while checking organizations
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // If user has organization(s), show loading while redirecting
  if (organizations.length >= 1) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Redirecting to your organization...</p>
        </div>
      </div>
    );
  }

  // No organizations - show create prompt
  return <NoOrgDashboard />;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        customer: newProject.client,
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
          <p className="text-muted-foreground">Manage architectural projects</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {organization.membersCount || 0} members
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <FolderOpen className="h-3 w-3" />
            {projects?.length || 0} projects
          </Badge>
          {team === null && (
            <Badge variant="outline" className="flex items-center gap-1">
              <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
              Syncing...
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Projects</h3>
          <p className="text-muted-foreground">List of current architectural projects</p>
        </div>
        
        <Dialog open={showNewProjectForm} onOpenChange={setShowNewProjectForm}>
          <DialogTrigger asChild>
            <Button disabled={!team?._id}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Project</DialogTitle>
              <DialogDescription>
                Create a new architectural project for team {organization.name}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    required
                  />
                </div>
                
                

                <div className="space-y-2">
                  <Label htmlFor="client">Client</Label>
                  <Input
                    id="client"
                    value={newProject.client}
                    onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={newProject.location}
                    onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">Budget (USD)</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={newProject.budget}
                    onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={newProject.startDate}
                    onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
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
                  Cancel
                </Button>
                <Button type="submit">
                  Create Project
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
              <CardTitle className="mb-2">No Projects</CardTitle>
              <CardDescription className="text-center mb-4">
                Create your first project to get started.
              </CardDescription>
              <Button onClick={() => setShowNewProjectForm(true)} disabled={!team?._id}>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  if (!user) return null;

  const userInitials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-12 w-12 rounded-full">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.imageUrl} alt={user.fullName || "User"} />
            <AvatarFallback className="bg-yellow-500 text-white font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.fullName || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/pricing")} className="cursor-pointer">
          <Sparkles className="mr-2 h-4 w-4" />
          <span>Rozszerz plan</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/personalization")} className="cursor-pointer">
          <Palette className="mr-2 h-4 w-4" />
          <span>Personalizacja</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          <span>Ustawienia</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/help")} className="cursor-pointer">
          <HelpCircle className="mr-2 h-4 w-4" />
          <span>Pomoc</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Wyloguj się</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NoOrgDashboard() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { createOrganization } = useOrganizationList();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <UserMenu />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Welcome to VibePlanner!</CardTitle>
          <CardDescription>
            It looks like you don't belong to any organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            To get started, create a new organization for your team.
          </p>
          <Button onClick={() => router.push("/organization")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Organization
          </Button>
        </CardContent>
      </Card>
    </div>
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