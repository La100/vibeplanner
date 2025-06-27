"use client";

import { useParams, useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { ArrowLeft, Plus, FolderOpen, Users, Calendar, MapPin, DollarSign, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function OrganizationPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const { organization, isLoaded } = useOrganization();
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  
  // Check if team exists first
  const team = useQuery(api.myFunctions.getTeamBySlug, 
    params.slug ? { slug: params.slug } : "skip"
  );
  
  // Get projects for this organization
  const projects = useQuery(api.myFunctions.listProjectsByClerkOrg, 
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );
  
  const createProject = useMutation(api.myFunctions.createProjectInOrg);
  
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    client: "",
    location: "",
    budget: "",
    startDate: "",
    endDate: "",
  });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !organization?.id) return;

    try {
      const { slug: newProjectSlug } = await createProject({
        name: newProject.name,
        description: newProject.description || undefined,
        clerkOrgId: organization.id,
        priority: newProject.priority,
        client: newProject.client || undefined,
        location: newProject.location || undefined,
        budget: newProject.budget ? parseFloat(newProject.budget) : undefined,
        startDate: newProject.startDate ? new Date(newProject.startDate).getTime() : undefined,
        endDate: newProject.endDate ? new Date(newProject.endDate).getTime() : undefined,
      });

      setNewProject({
        name: "",
        description: "",
        priority: "medium",
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
      console.error("Error creating project:", error);
    }
  };

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

  console.log("Organization data:", organization);
  console.log("Team data:", team);
  console.log("Projects data:", projects);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        {/* Header */}
        <div className="border-b bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold">{organization.name}</h1>
                <p className="text-muted-foreground mt-1">
                  Zespół architektoniczny
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {organization.membersCount} członków
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
              {team && (
                <Badge variant="outline" className="flex items-center gap-1 text-green-600">
                  <div className="h-2 w-2 bg-green-500 rounded-full" />
                  Zsynchronizowany
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <Tabs defaultValue="projects">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Projekty
              </TabsTrigger>
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Przegląd
              </TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="mt-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Projekty zespołu</h2>
                    <p className="text-muted-foreground">Zarządzaj projektami architektonicznymi</p>
                  </div>
                  
                  <Dialog open={showNewProjectForm} onOpenChange={setShowNewProjectForm}>
                    <DialogTrigger asChild>
                      <Button>
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
                            <Label htmlFor="priority">Priorytet</Label>
                            <Select
                              value={newProject.priority}
                              onValueChange={(value) => setNewProject({ ...newProject, priority: value as "low" | "medium" | "high" | "urgent" })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Niski</SelectItem>
                                <SelectItem value="medium">Średni</SelectItem>
                                <SelectItem value="high">Wysoki</SelectItem>
                                <SelectItem value="urgent">Pilny</SelectItem>
                              </SelectContent>
                            </Select>
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects?.map((project) => (
                    <ProjectCard 
                      key={project._id} 
                      project={project} 
                      onClick={() => router.push(`/${params.slug}/${project.slug}`)}
                    />
                  ))}
                  
                  {(!projects || projects.length === 0) && (
                    <Card className="col-span-full">
                      <CardContent className="flex flex-col items-center justify-center py-8">
                        <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
                        <CardTitle className="mb-2">Brak projektów w tym zespole</CardTitle>
                        <CardDescription className="text-center mb-4">
                          Utwórz pierwszy projekt, aby rozpocząć pracę.
                        </CardDescription>
                        <Button onClick={() => setShowNewProjectForm(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Nowy projekt
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="overview" className="mt-6">
              <div className="space-y-6">
                <h2 className="text-2xl font-bold tracking-tight">Przegląd zespołu</h2>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Projekty</CardTitle>
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{projects?.length || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        Wszystkie projekty zespołu
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Członkowie</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{organization.membersCount}</div>
                      <p className="text-xs text-muted-foreground">
                        Członkowie zespołu
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Zadania</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {projects?.reduce((sum, p) => sum + (p.taskCount || 0), 0) || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Wszystkie zadania
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, onClick }: { 
  project: {
    _id: string;
    name: string;
    description?: string;
    priority: string;
    client?: string;
    location?: string;
    budget?: number;
    taskCount: number;
    completedTasks: number;
  }; 
  onClick: () => void 
}) {
  const getPriorityVariant = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "secondary";
    }
  };

  const progress = project.taskCount > 0 ? (project.completedTasks / project.taskCount) * 100 : 0;

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="line-clamp-1">{project.name}</CardTitle>
          <Badge variant={getPriorityVariant(project.priority)}>
            {project.priority?.toUpperCase()}
          </Badge>
        </div>
        
        {project.description && (
          <CardDescription className="line-clamp-2">{project.description}</CardDescription>
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
            <span className="text-muted-foreground">Postęp</span>
            <span className="font-medium">{project.completedTasks || 0}/{project.taskCount || 0} zadań</span>
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
            <span>Kliknij, aby otworzyć</span>
          </div>
          {project.budget && (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span>{project.budget.toLocaleString("pl-PL")} PLN</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}