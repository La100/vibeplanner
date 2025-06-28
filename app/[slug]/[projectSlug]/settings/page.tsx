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

const nameFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters")
});

export default function ProjectSettingsPage() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const router = useRouter();
  
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

  const nameForm = useForm<z.infer<typeof nameFormSchema>>({
    resolver: zodResolver(nameFormSchema),
    defaultValues: { name: project?.name || "" },
    values: project ? { name: project.name } : undefined,
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
    </div>
  );
} 