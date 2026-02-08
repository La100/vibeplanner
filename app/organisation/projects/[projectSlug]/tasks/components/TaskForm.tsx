"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Doc, Id } from "@/convex/_generated/dataModel";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { DatePicker } from "@/components/ui/date-picker";

const taskFormSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    dueDate: z.date().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
    projectId: Id<"projects">;
    teamId: Id<"teams">;
    teamMembers: { clerkUserId: string; name: string; }[];
    task?: Doc<"tasks">;
    onTaskCreated?: () => void;
    setIsOpen: (isOpen: boolean) => void;
}

export default function TaskForm({ projectId, teamId, task, onTaskCreated, setIsOpen }: TaskFormProps) {
    const updateTask = useMutation(apiAny.tasks.updateTask);
    const createTask = useMutation(apiAny.tasks.createTask);

    const titlePlaceholder = "e.g. Register a domain";
    const dateLabel = "Due date";
    const descriptionPlaceholder = "Describe the task...";

    const form = useForm<TaskFormValues>({
        resolver: zodResolver(taskFormSchema),
        defaultValues: task
            ? {
                title: task.title,
                description: task.description,
                dueDate: task.endDate ? new Date(task.endDate) : undefined,
            }
            : {
                title: "",
                description: "",
                dueDate: undefined,
            },
    });

    const onSubmit = async (values: TaskFormValues) => {
        try {
            const endDateTimestamp = values.dueDate ? values.dueDate.getTime() : undefined;

            if (task) {
                const updatePayload: Parameters<typeof updateTask>[0] = {
                    taskId: task._id,
                    title: values.title,
                    description: values.description,
                    endDate: endDateTimestamp,
                };
                await updateTask(updatePayload);
                toast.success("Task updated");
            } else {
                const createPayload: Parameters<typeof createTask>[0] = {
                    projectId,
                    teamId,
                    title: values.title,
                    description: values.description,
                    status: "todo",
                    endDate: endDateTimestamp,
                };
                await createTask(createPayload);
                toast.success("Task created");
                form.reset();
            }
            onTaskCreated?.();
            setIsOpen(false);
        } catch (error) {
            toast.error("Something went wrong");
            console.error(error);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                                <Input placeholder={titlePlaceholder} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>{dateLabel}</FormLabel>
                            <DatePicker date={field.value} onDateChange={field.onChange} />
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder={descriptionPlaceholder}
                                    className="resize-none"
                                    {...field}
                                    value={field.value ?? ""}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
                    {task ? "Save Task" : "Create Task"}
                </Button>
            </form>
        </Form>
    );
}
