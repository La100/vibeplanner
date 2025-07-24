"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

import { Plus, FolderOpen, MapPin, DollarSign, Building2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";


export default function CompanyProjects() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const { organization, isLoaded } = useOrganization();
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
  
  const createProject = useMutation(api.projects.createProjectInOrg);
  const checkLimits = useQuery(api.stripe.checkTeamLimits, 
    team?._id ? { 
      teamId: team._id, 
      action: "create_project" 
    } : "skip"
  );
  
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    client: "",
    location: "",
    budget: "",
    startDate: "",
    endDate: "",
  });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !organization?.id || !team?._id) return;

    // Check subscription limits first
    if (checkLimits && !checkLimits.allowed) {
      if (checkLimits.reason === "project_limit_reached") {
        alert(`You've reached the maximum number of projects (${checkLimits.limit}) for your current plan. Please upgrade to continue.`);
      } else {
        alert(checkLimits.message || "Unable to create project due to subscription limits.");
      }
      return;
    }

    try {
      const { slug: newProjectSlug } = await createProject({
        name: newProject.name,
        description: newProject.description || undefined,
        clerkOrgId: organization.id,
        teamId: team._id,
        customer: newProject.client || undefined,
        location: newProject.location || undefined,
        budget: newProject.budget ? parseFloat(newProject.budget) : undefined,
        startDate: newProject.startDate ? new Date(newProject.startDate).getTime() : undefined,
        endDate: newProject.endDate ? new Date(newProject.endDate).getTime() : undefined,
      });

      setNewProject({
        name: "",
        description: "",
        client: "",
        location: "",
        budget: "",
        startDate: "",
        endDate: "",
      });
      setShowNewProjectForm(false);
      
      // Navigate to the new project
      if (newProjectSlug) {
        router.push(`/${params.slug}/${newProjectSlug}`);
      }
    } catch (error) {
      console.error("Błąd podczas tworzenia projektu:", error);
    }
  };

  // Filter projects
  const filteredProjects = projects?.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         project.client?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  if (!isLoaded || !organization) {
    return <div className="flex items-center justify-center min-h-screen">Ładowanie...</div>;
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Projects</h1>
          
          <Dialog open={showNewProjectForm} onOpenChange={setShowNewProjectForm}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Create a new project for {organization.name}
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
                    <Label htmlFor="budget">Budget</Label>
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

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects?.map((project) => (
          <ProjectCard 
            key={project._id}
            project={{
              _id: project._id,
              name: project.name,
              description: project.description,
              client: project.client,
              location: project.location,
              budget: project.budget,
              taskCount: teamTasks?.filter(t => t.projectId === project._id).length || 0,
              completedTasks: teamTasks?.filter(t => t.projectId === project._id && t.status === 'done').length || 0,
            }}
            onClick={() => router.push(`/${params.slug}/${project.slug}`)}
          />
        ))}
        
        {(!filteredProjects || filteredProjects.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">No projects found</CardTitle>
              <CardDescription className="text-center mb-4">
                 {searchQuery ? 
                    "No projects match your search criteria." :
                    "Create your first project to get started."
                  }
              </CardDescription>
              <Button onClick={() => setShowNewProjectForm(true)}>
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
              <MapPin className="mr-2 h-4 w-4" />
              <span>{project.location}</span>
            </div>
          )}
          {project.budget && (
            <div className="flex items-center">
              <DollarSign className="mr-2 h-4 w-4" />
              <span>{project.budget.toLocaleString()} PLN</span>
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