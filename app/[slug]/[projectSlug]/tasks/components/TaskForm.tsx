"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Wand2 } from "lucide-react";

import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";


const taskFormSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    status: z.enum(["todo", "in_progress", "review", "done"]).optional(),
    assignedTo: z.string().optional(),
    dueDate: z.date().optional(),
    cost: z.coerce.number().optional(),
});
  
type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
    projectId: Id<"projects">;
    task?: Doc<"tasks">;
    onTaskCreated?: () => void;
    setIsOpen: (isOpen: boolean) => void;
}
  
export default function TaskForm({ projectId, task, onTaskCreated, setIsOpen }: TaskFormProps) {
    const [aiMessage, setAiMessage] = useState("");
    const [isParsing, setIsParsing] = useState(false);

    const updateTask = useMutation(api.myFunctions.updateTask);
    const createTask = useMutation(api.myFunctions.createTask);
    const parseTask = useAction(api.myFunctions.parseTaskFromChat);

    const form = useForm<TaskFormValues>({
      resolver: zodResolver(taskFormSchema),
      defaultValues: task
        ? {
            ...task,
            dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          }
        : {
            title: "",
            description: "",
            priority: "medium",
            status: "todo",
            assignedTo: "",
            dueDate: undefined,
            cost: undefined,
          },
    });
  
    useEffect(() => {
      if (task) {
        form.reset({
            ...task,
            dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        });
      }
    }, [task, form]);
  
    const handleParse = async () => {
        setIsParsing(true);
        try {
            const result = await parseTask({ message: aiMessage, projectId });
            if (result && result.isTask) {
                form.reset({
                    title: result.title || "",
                    description: result.description || "",
                    priority: result.priority || "medium",
                    status: result.status || "todo",
                    dueDate: result.dueDate ? new Date(result.dueDate) : undefined,
                    cost: result.cost || undefined,
                });
                toast.success("Task parsed from message!");
            } else {
                toast.info("Could not find a task in the message.");
            }
        } catch (error) {
            toast.error("AI parsing failed.");
            console.error(error);
        } finally {
            setIsParsing(false);
        }
    }

    const onSubmit = async (values: TaskFormValues) => {
      try {
        const submissionData = {
            ...values,
            dueDate: values.dueDate ? values.dueDate.getTime() : undefined,
        };

        if (task) {
          await updateTask({
            taskId: task._id,
            ...submissionData,
          });
          toast.success("Task updated");
        } else {
          await createTask({
            projectId,
            ...submissionData,
            tags: [], 
          });
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
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <Input 
                    value={aiMessage}
                    onChange={(e) => setAiMessage(e.target.value)}
                    placeholder="Create a task for 'Design review' due tomorrow with high priority and cost 150..."
                    disabled={isParsing}
                    className="flex-1"
                />
                <Button 
                    onClick={handleParse} 
                    disabled={isParsing || !aiMessage}
                    className="w-full sm:w-auto shrink-0"
                >
                    {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    <span className="ml-2 sm:hidden">Parse</span>
                </Button>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g. Implement new feature" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="review">Review</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Due Date</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "pl-3 text-left font-normal w-full",
                                    !field.value && "text-muted-foreground"
                                    )}
                                >
                                    {field.value ? (
                                    format(field.value, "PPP")
                                    ) : (
                                    <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                                />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="cost"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Cost</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="Task cost" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                        <Textarea 
                            placeholder="Add a more detailed description..." 
                            {...field} 
                            className="min-h-[100px] resize-none"
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
                    {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {task ? "Save Changes" : "Create Task"}
                </Button>
                </form>
            </Form>
        </div>
    );
} 