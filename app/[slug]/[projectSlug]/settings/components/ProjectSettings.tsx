"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Users, Settings, Shield, AlertTriangle, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TaskStatusSettings from "./TaskStatusSettings";
import ProjectMembers from "./ProjectMembers";
import SidebarPermissions from "./SidebarPermissions";
import { Skeleton } from "@/components/ui/skeleton";


const settingsFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  currency: z.enum(["USD", "EUR", "PLN"]).optional(),
});

const deleteFormSchema = z.object({
  confirmName: z.string().min(1, "Please enter the project name to confirm deletion")
});

function ProjectSettingsSkeleton() {
  return (
    <div className="mt-4 lg:mt-8 px-4 lg:px-0 pb-8 animate-pulse">
      <div className="mb-6">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-5 w-3/4 mt-2" />
      </div>

      <div className="grid w-full grid-cols-5 h-auto p-1 mb-6 border rounded-md">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1 p-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="px-4 lg:px-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectSettingsContent() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "members" | "permissions" | "taskstatus" | "advanced">("general");
  
  const project = useQuery(api.projects.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const hasAccess = useQuery(api.projects.checkUserProjectAccess, 
    project ? { projectId: project._id } : "skip"
  );

  const teamMember = useQuery(api.teams.getCurrentUserTeamMember, 
    project ? { teamId: project.teamId } : "skip"
  );

  const updateProject = useMutation(api.projects.updateProject);
  const deleteProject = useMutation(api.projects.deleteProject);

  const settingsForm = useForm<z.infer<typeof settingsFormSchema>>({
    resolver: zodResolver(settingsFormSchema),
    values: project ? { 
      name: project.name,
      currency: project.currency || "USD",
    } : { name: "", currency: "USD" },
  });

  const deleteForm = useForm<z.infer<typeof deleteFormSchema>>({
    resolver: zodResolver(deleteFormSchema),
    defaultValues: { confirmName: "" },
  });

  if (!project || hasAccess === false || !teamMember) {
    if (hasAccess === false) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access project settings.</p>
        </div>
      );
    }
    // Let suspense handle the rest
    return null;
  }
  
  const canEdit = teamMember && (teamMember.role === "admin" || teamMember.role === "member");

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h1 className="text-2xl font-bold text-orange-600 mb-2">Read Only</h1>
        <p className="text-muted-foreground">You can view this project but cannot modify its settings.</p>
      </div>
    );
  }

  async function onSettingsSubmit(values: z.infer<typeof settingsFormSchema>) {
    try {
      const result = await updateProject({ 
        projectId: project!._id, 
        name: values.name,
        currency: values.currency,
      });
      toast.success("Project settings updated");
      
      if (result?.slug && result.slug !== params.projectSlug) {
        router.push(`/${params.slug}/${result.slug}/settings`);
      }
    } catch (error) {
      toast.error("Error updating project settings", {
        description: (error as Error).message || "There was a problem updating the project settings."
      });
    }
  }

  async function onDeleteSubmit(values: z.infer<typeof deleteFormSchema>) {
    if (values.confirmName !== project!.name) {
      deleteForm.setError("confirmName", {
        message: "Project name doesn't match. Please type the exact project name."
      });
      return;
    }

    try {
      await deleteProject({ projectId: project!._id });
      toast.success("Project deleted successfully");
      setDeleteDialogOpen(false);
      router.push(`/${params.slug}`);
    } catch (error) {
      toast.error("Error deleting project", {
        description: (error as Error).message || "There was a problem deleting the project."
      });
    }
  }

  return (
    <div className="mt-4 lg:mt-8 px-4 lg:px-0 pb-8">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold">Project Settings</h1>
        <p className="text-muted-foreground text-sm lg:text-base mt-1">Manage your project configuration and access.</p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto p-1 mb-6">
          <TabsTrigger value="general" className="flex flex-col items-center gap-1 p-2 text-xs data-[state=active]:bg-background">
            <Settings className="h-4 w-4" />
            <span className="text-xs">General</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="flex flex-col items-center gap-1 p-2 text-xs data-[state=active]:bg-background">
            <Users className="h-4 w-4" />
            <span className="text-xs">Members</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex flex-col items-center gap-1 p-2 text-xs data-[state=active]:bg-background">
            <Eye className="h-4 w-4" />
            <span className="text-xs">Permissions</span>
          </TabsTrigger>
          <TabsTrigger value="taskstatus" className="flex flex-col items-center gap-1 p-2 text-xs data-[state=active]:bg-background">
            <Shield className="h-4 w-4" />
            <span className="text-xs">Status</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex flex-col items-center gap-1 p-2 text-xs data-[state=active]:bg-background">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs">Advanced</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0">
          <GeneralTab 
            settingsForm={settingsForm}
            onSettingsSubmit={onSettingsSubmit}
          />
        </TabsContent>

        <TabsContent value="members" className="mt-0">
           <Suspense fallback={<Card><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>}>
            <MembersTab project={project} />
          </Suspense>
        </TabsContent>

        <TabsContent value="permissions" className="mt-0">
           <Suspense fallback={<Card><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>}>
            <PermissionsTab project={project} />
          </Suspense>
        </TabsContent>

        <TabsContent value="taskstatus" className="mt-0">
           <Suspense fallback={<Card><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>}>
            <TaskStatusTab project={project} />
          </Suspense>
        </TabsContent>

        <TabsContent value="advanced" className="mt-0">
          <AdvancedTab 
            project={project}
            deleteForm={deleteForm}
            deleteDialogOpen={deleteDialogOpen}
            setDeleteDialogOpen={setDeleteDialogOpen}
            onDeleteSubmit={onDeleteSubmit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProjectSettings() {
  return (
    <Suspense fallback={<ProjectSettingsSkeleton />}>
      <ProjectSettingsContent />
    </Suspense>
  );
}

// General Settings Tab
function GeneralTab({ 
  settingsForm, 
  onSettingsSubmit 
}: {
  settingsForm: UseFormReturn<z.infer<typeof settingsFormSchema>>;
  onSettingsSubmit: (values: z.infer<typeof settingsFormSchema>) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg lg:text-xl">General Settings</CardTitle>
        <CardDescription className="text-sm">
          Manage your project's basic information and preferences.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 lg:px-6">
        <Form {...settingsForm}>
          <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-4 lg:space-y-6">
            <FormField
              control={settingsForm.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium">Project Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Project name" 
                      {...field} 
                      className="w-full h-10 text-base" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={settingsForm.control}
              name="currency"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium">Currency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder="Select project currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="PLN">PLN (zł)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="pt-2">
              <Button 
                type="submit" 
                disabled={settingsForm.formState.isSubmitting}
                className="w-full h-10 text-base font-medium"
              >
                {settingsForm.formState.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// Members Tab
function MembersTab({ project }: { project: { _id: Id<"projects">; teamId: Id<"teams">; name: string } }) {
  return <ProjectMembers project={project} />;
}

// Permissions Tab
function PermissionsTab({ project }: { project: { _id: Id<"projects">; teamId: Id<"teams">; name: string } }) {
  return <SidebarPermissions projectId={project._id} />;
}

// Task Status Tab
function TaskStatusTab({ project }: { project: { _id: string; taskStatusSettings?: unknown } }) {
  return (
    <div>
              {project && project.taskStatusSettings ? (
          <TaskStatusSettings projectId={project._id as Id<"projects">} initialSettings={project.taskStatusSettings as { todo: { name: string; color: string }; in_progress: { name: string; color: string }; review: { name: string; color: string }; done: { name: string; color: string } }} />
        ) : (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg lg:text-xl">Task Status Settings</CardTitle>
            <CardDescription className="text-sm">
              Configure custom task statuses for this project.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 lg:px-6">
            <p className="text-muted-foreground text-sm">Task status settings will be available here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Advanced Tab with Danger Zone
function AdvancedTab({
  project,
  deleteForm,
  deleteDialogOpen,
  setDeleteDialogOpen,
  onDeleteSubmit
}: {
  project: { name: string };
  deleteForm: UseFormReturn<z.infer<typeof deleteFormSchema>>;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  onDeleteSubmit: (values: z.infer<typeof deleteFormSchema>) => void;
}) {
  return (
    <div className="space-y-4 lg:space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg lg:text-xl">Advanced Settings</CardTitle>
          <CardDescription className="text-sm">
            Advanced configuration options for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6">
          <p className="text-muted-foreground text-sm">Advanced settings will be available here in future updates.</p>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-red-600 text-lg lg:text-xl">Danger Zone</CardTitle>
          <CardDescription className="text-sm">
            Irreversible and destructive actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 lg:px-6">
          <div>
            <h4 className="text-sm font-medium text-red-600 mb-2">Delete Project</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete a project, there is no going back. This will permanently delete the project,
              all its tasks, files, comments, and related data.
            </p>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  Delete Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] mx-4">
                <DialogHeader>
                  <DialogTitle className="text-lg">Delete Project</DialogTitle>
                  <DialogDescription className="text-sm">
                    This action cannot be undone. This will permanently delete the "{project.name}" project
                    and remove all associated data from our servers.
                  </DialogDescription>
                </DialogHeader>
                <Form {...deleteForm}>
                  <form onSubmit={deleteForm.handleSubmit(onDeleteSubmit)} className="space-y-4 lg:space-y-6">
                    <FormField
                      control={deleteForm.control}
                      name="confirmName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">
                            Type <span className="font-mono font-semibold">{project.name}</span> to confirm:
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={project.name}
                              {...field}
                              autoComplete="off"
                              className="w-full"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDeleteDialogOpen(false)}
                        className="w-full sm:w-auto"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="destructive"
                        disabled={deleteForm.formState.isSubmitting}
                        className="w-full sm:w-auto"
                      >
                        {deleteForm.formState.isSubmitting ? "Deleting..." : "Delete Project"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 