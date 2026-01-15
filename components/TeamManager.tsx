"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { 
  Users, 
  FolderOpen,
  ArrowLeft,
  Settings,
  Building2,
  Plus,
  Play,
  Clock,
  Pause,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@clerk/nextjs";

type Team = {
  _id: Id<"teams">;
  _creationTime: number;
  name: string;
  description?: string;
  clerkOrgId: string;
  createdBy: string;
  userRole: string;
  memberCount: number;
  projectCount: number;
  members?: Array<{
    _id: Id<"teamMembers">;
    clerkUserId: string;
    role: string;
    joinedAt: number;
    isActive: boolean;
  }>;
};

type Project = {
  _id: Id<"projects">;
  _creationTime: number;
  name: string;
  description?: string;
  status: string;
  client?: string;
  location?: string;
  createdBy: string;
  startDate?: number;
  endDate?: number;
  budget?: number;
  taskCount: number;
  completedTasks: number;
  assignedTo: string[];
};

interface TeamManagerProps {
  team: Team;
  onBack: () => void;
  onProjectClick: (projectId: Id<"projects">) => void;
}

export default function TeamManager({ team, onBack, onProjectClick }: TeamManagerProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "projects" | "members">("projects");
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);

  const projects = useQuery(api.projects.listTeamProjects, { teamId: team._id });
  const createProject = useMutation(api.projects.createProjectInOrg);

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
    if (!newProject.name) return;

    try {
      await createProject({
        name: newProject.name,
        description: newProject.description || undefined,
        clerkOrgId: team.clerkOrgId,
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
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{team.name}</h1>
              {team.description && (
                <p className="text-muted-foreground mt-1">{team.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {team.memberCount} members
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <FolderOpen className="h-3 w-3" />
                {team.projectCount} projects
              </Badge>
            </div>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "overview" | "projects" | "members")}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-6">
            <ProjectsTab 
              projects={projects || []}
              onProjectClick={onProjectClick}
              showNewProjectForm={showNewProjectForm}
              setShowNewProjectForm={setShowNewProjectForm}
              newProject={newProject}
              setNewProject={setNewProject}
              handleCreateProject={handleCreateProject}
            />
          </TabsContent>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab team={team} projects={projects || []} />
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <MembersTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProjectsTab({
  projects,
  onProjectClick,
  showNewProjectForm,
  setShowNewProjectForm,
  newProject,
  setNewProject,
  handleCreateProject
}: {
  projects: Project[];
  onProjectClick: (projectId: Id<"projects">) => void;
  showNewProjectForm: boolean;
  setShowNewProjectForm: (show: boolean) => void;
  newProject: {
    name: string;
    description: string;
    client: string;
    location: string;
    budget: string;
    startDate: string;
    endDate: string;
  };
  setNewProject: (project: {
    name: string;
    description: string;
    client: string;
    location: string;
    budget: string;
    startDate: string;
    endDate: string;
  }) => void;
  handleCreateProject: (e: React.FormEvent) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team Projects</h2>
          <p className="text-muted-foreground">Manage architectural projects</p>
        </div>
        
        <Button onClick={() => setShowNewProjectForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {showNewProjectForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Project</CardTitle>
            <CardDescription>Create a new architectural project for the team</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <ProjectCard 
            key={project._id} 
            project={project} 
            onClick={() => onProjectClick(project._id)}
          />
        ))}
        
        {projects.length === 0 && !showNewProjectForm && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">No projects in this team</CardTitle>
              <CardDescription className="text-center mb-4">
                Create your first project to get started.
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

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const progress = project.taskCount > 0 ? (project.completedTasks / project.taskCount) * 100 : 0;

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "active": return "default";
      case "planning": return "secondary";
      case "on_hold": return "outline";
      case "completed": return "default"; // Maybe a different color for completed
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

  return (
    <Card onClick={onClick} className="cursor-pointer hover:bg-muted/50 transition-all">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold line-clamp-1">{project.name}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant(project.status)} className="flex items-center gap-1">
            {getStatusIcon(project.status)}
            <span>{project.status.replace('_', ' ').toUpperCase()}</span>
          </Badge>
        </div>
        {project.description && (
          <CardDescription className="line-clamp-2 mt-2">{project.description}</CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {project.client && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span>{project.client}</span>
          </div>
        )}
        
        {project.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{project.location}</span>
          </div>
        )}
        
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{project.completedTasks}/{project.taskCount} tasks</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Click to open</span>
          </div>
          {project.budget && (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span>{project.budget.toLocaleString("en-US")} USD</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab({ team, projects }: { team: Team; projects: Project[] }) {
  const activeProjects = projects.filter(p => p.status === "active").length;
  const completedProjects = projects.filter(p => p.status === "completed").length;
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Team Overview</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Members</p>
              <p className="text-2xl font-bold text-gray-900">{team.memberCount}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">All Projects</p>
              <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
            </div>
            <FolderOpen className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Projects</p>
              <p className="text-2xl font-bold text-gray-900">{activeProjects}</p>
            </div>
            <Play className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{completedProjects}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Projects</h3>
        {projects.length > 0 ? (
          <div className="space-y-3">
            {projects.slice(0, 5).map((project) => (
              <div key={project._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{project.name}</h4>
                  <p className="text-sm text-gray-600">{project.client || "No client"}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    project.status === "completed" ? "bg-green-100 text-green-800" :
                    project.status === "active" ? "bg-blue-100 text-blue-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {project.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No projects in this team</p>
        )}
      </div>
    </div>
  );
}

function MembersTab() {
  const { organization } = useOrganization();
  const team = useQuery(
    api.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  const handleGoToTeamManagement = () => {
    if (team) {
      window.location.href = "/organisation/team";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Team Member Management</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Manage your team members, roles, and invitations from the dedicated Team Management page.
            </p>
            <Button onClick={handleGoToTeamManagement}>
              <Users className="mr-2 h-4 w-4" />
              Go to Team Management
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
