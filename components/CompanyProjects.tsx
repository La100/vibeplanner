"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

import { Plus, FolderOpen, MapPin, DollarSign, Building2, Search, AlertTriangle, Sparkles, Play, Clock, Pause, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";


export default function CompanyProjects() {
  const router = useRouter();
  const { organization, isLoaded } = useOrganization();
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Check if team exists first
  const team = useQuery(api.teams.getTeamByClerkOrg, 
    organization?.id ? { clerkOrgId: organization.id } : "skip"
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
      setShowUpgradeDialog(true);
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
        router.push(`/organisation/projects/${newProjectSlug}`);
      }
    } catch (error) {
      console.error("Error creating project:", error);
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
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
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
        {projects === undefined ? (
          // Loading skeleton
          Array(3).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                </div>
                <div className="space-y-1">
                  <div className="h-3 bg-muted rounded w-1/3"></div>
                  <div className="h-2 bg-muted rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredProjects && filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <ProjectCard 
              key={project._id}
              project={{
                _id: project._id,
                name: project.name,
                description: project.description,
                client: project.client,
                location: project.location,
                budget: project.budget,
                status: project.status,
                taskCount: teamTasks?.filter(t => t.projectId === project._id).length || 0,
                completedTasks: teamTasks?.filter(t => t.projectId === project._id && t.status === 'done').length || 0,
              }}
              onClick={() => router.push(`/organisation/projects/${project.slug}`)}
            />
          ))
        ) : (
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

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <AlertTriangle className="h-7 w-7 text-orange-600" />
            </div>
            <DialogTitle className="text-xl">Project limit reached</DialogTitle>
            <DialogDescription className="text-base">
              You&apos;ve reached the maximum number of projects ({checkLimits?.limit || 3}) for the Free plan.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold">AI Pro</p>
                <p className="text-sm text-muted-foreground">$39/month</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>20 projects</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>25 team members</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>AI Assistant & image generation</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>50 GB storage</span>
              </li>
            </ul>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
              onClick={() => {
                setShowUpgradeDialog(false);
                router.push("/organisation/settings?tab=subscription");
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Upgrade to AI Pro
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowUpgradeDialog(false)}
            >
              Maybe later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    status?: string;
    taskCount: number;
    completedTasks: number;
  }; 
  onClick: () => void 
}) {
  const progress = project.taskCount > 0 ? (project.completedTasks / project.taskCount) * 100 : 0;

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "active": return "default";
      case "planning": return "secondary";
      case "on_hold": return "outline";
      case "completed": return "default";
      case "cancelled": return "destructive";
      default: return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <Play className="h-3 w-3" />;
      case "planning": return <Clock className="h-3 w-3" />;
      case "on_hold": return <Pause className="h-3 w-3" />;
      case "completed": return <CheckCircle2 className="h-3 w-3" />;
      case "cancelled": return <AlertCircle className="h-3 w-3" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Aktywny";
      case "planning": return "Planowanie";
      case "on_hold": return "Wstrzymany";
      case "completed": return "Completed";
      case "cancelled": return "Anulowany";
      default: return status?.replace('_', ' ').toUpperCase() || "—";
    }
  };

  return (
    <Card onClick={onClick} className="cursor-pointer hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{project.name}</CardTitle>
        </div>
        {project.status && (
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={getStatusVariant(project.status)} className="flex items-center gap-1">
              {getStatusIcon(project.status)}
              <span>{getStatusLabel(project.status)}</span>
            </Badge>
          </div>
        )}
        {project.description && <CardDescription className="mt-2">{project.description}</CardDescription>}
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
