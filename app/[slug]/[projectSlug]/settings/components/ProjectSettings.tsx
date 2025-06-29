"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteClientForm } from "@/components/InviteClientForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

const nameFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters")
});

const deleteFormSchema = z.object({
  confirmName: z.string().min(1, "Please enter the project name to confirm deletion")
});

export default function ProjectSettings() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const project = useQuery(api.myFunctions.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const hasAccess = useQuery(api.myFunctions.checkUserProjectAccess, 
    project ? { projectId: project._id } : "skip"
  );

  const teamMember = useQuery(api.myFunctions.getCurrentUserTeamMember, 
    project ? { teamId: project.teamId } : "skip"
  );

  const updateProject = useMutation(api.myFunctions.updateProject);
  const deleteProject = useMutation(api.myFunctions.deleteProject);

  const nameForm = useForm<z.infer<typeof nameFormSchema>>({
    resolver: zodResolver(nameFormSchema),
    defaultValues: { name: project?.name || "" },
    values: project ? { name: project.name } : undefined,
  });

  const deleteForm = useForm<z.infer<typeof deleteFormSchema>>({
    resolver: zodResolver(deleteFormSchema),
    defaultValues: { confirmName: "" },
  });

  if (project === undefined) {
    return <div>Loading project details...</div>;
  }
  if (project === null) {
    return <div>Project not found.</div>;
  }

  if (hasAccess === undefined || teamMember === undefined) {
    return <div>Loading permissions...</div>;
  }

  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to access project settings.</p>
      </div>
    );
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

  async function onNameSubmit(values: z.infer<typeof nameFormSchema>) {
    try {
      const result = await updateProject({ projectId: project!._id, name: values.name });
      toast.success("Project name updated");
      
      // Jeśli slug się zmienił, przekieruj do nowego URL
      if (result?.slug && result.slug !== params.projectSlug) {
        router.push(`/${params.slug}/${result.slug}/settings`);
      }
    } catch (error) {
      toast.error("Error updating project name", {
        description: (error as Error).message || "There was a problem updating the project name."
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
    <div className="max-w-xl mx-auto mt-8 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Project Name</CardTitle>
          <CardDescription>
            Change the name of your project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...nameForm}>
            <form onSubmit={nameForm.handleSubmit(onNameSubmit)} className="space-y-4">
              <FormField
                control={nameForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Project name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={nameForm.formState.isSubmitting}>
                {nameForm.formState.isSubmitting ? "Saving..." : "Save"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Invite a Client</CardTitle>
          <CardDescription>
            Invite a client to view this project. They will only have access to this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteClientForm projectId={project._id} />
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-red-600 mb-2">Delete Project</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Once you delete a project, there is no going back. This will permanently delete the project,
                all its tasks, files, comments, and related data.
              </p>
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    Delete Project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Project</DialogTitle>
                    <DialogDescription>
                      This action cannot be undone. This will permanently delete the "{project.name}" project
                      and remove all associated data from our servers.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...deleteForm}>
                    <form onSubmit={deleteForm.handleSubmit(onDeleteSubmit)} className="space-y-6">
                      <FormField
                        control={deleteForm.control}
                        name="confirmName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Type <span className="font-mono font-semibold">{project.name}</span> to confirm:
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={project.name}
                                {...field}
                                autoComplete="off"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDeleteDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="destructive"
                          disabled={deleteForm.formState.isSubmitting}
                        >
                          {deleteForm.formState.isSubmitting ? "Deleting..." : "Delete Project"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 