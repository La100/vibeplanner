"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const statusSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
});

const taskStatusSettingsSchema = z.object({
  statuses: z.object({
    todo: statusSchema,
    in_progress: statusSchema,
    review: statusSchema,
    done: statusSchema,
  }),
});

type TaskStatusSettingsFormValues = z.infer<typeof taskStatusSettingsSchema>;

interface TaskStatusSettingsProps {
  projectId: Id<"projects">;
  initialSettings: {
    todo: { name: string; color: string };
    in_progress: { name: string; color: string };
    review: { name: string; color: string };
    done: { name: string; color: string };
  };
}

export default function TaskStatusSettings({ projectId, initialSettings }: TaskStatusSettingsProps) {
  const updateSettings = useMutation(api.projects.updateProjectTaskStatusSettings);

  const form = useForm<TaskStatusSettingsFormValues>({
    resolver: zodResolver(taskStatusSettingsSchema),
    defaultValues: {
      statuses: initialSettings,
    },
  });

  const statusKeys = Object.keys(initialSettings) as Array<keyof typeof initialSettings>;

  const onSubmit = async (values: TaskStatusSettingsFormValues) => {
    try {
      await updateSettings({
        projectId: projectId,
        settings: values.statuses,
      });
      toast.success("Task status settings updated successfully!");
    } catch (error) {
      console.error("Failed to update task status settings:", error);
      toast.error("Failed to update settings.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task Status Settings</CardTitle>
        <CardDescription>
          Customize the names and colors for your task statuses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-6">
              {statusKeys.map((key) => (
                <div key={key} className="p-4 border rounded-md">
                  <h4 className="text-lg font-medium capitalize mb-4">{key.replace("_", " ")}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`statuses.${key}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`statuses.${key}.color`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <Input type="color" {...field} className="p-1 h-10 w-14" />
                              <Input
                                {...field}
                                placeholder="#RRGGBB"
                                className="flex-1"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save Status Settings"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
} 