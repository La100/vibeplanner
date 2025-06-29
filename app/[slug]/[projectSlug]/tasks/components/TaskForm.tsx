"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Send, Bot, X, Plus } from "lucide-react";

interface ParsedTask {
  isTask: boolean;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent" | null;
  dueDate: string | null;
  tags: string[];
}

interface TaskFormProps {
  projectId: Id<"projects">;
  onTaskCreated: () => void;
}

const taskFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueDate: z.string().optional(),
});

export default function TaskForm({ projectId, onTaskCreated }: TaskFormProps) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isAIMode, setIsAIMode] = useState(false);
  
  const parseTask = useAction(api.myFunctions.parseTaskFromChat);
  const createTask = useMutation(api.myFunctions.createTask);

  const form = useForm<z.infer<typeof taskFormSchema>>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: undefined,
      dueDate: "",
    },
  });

  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const result = await parseTask({
        message: message.trim(),
        projectId,
      });

      if (result.isTask) {
        // Wypełnij formularz danymi z AI
        form.setValue("title", result.title);
        form.setValue("description", result.description || "");
        form.setValue("priority", result.priority || undefined);
        
        // Poprawne formatowanie daty dla input type="date"
        if (result.dueDate) {
          let dateValue = "";
          try {
            // Sprawdź czy to już jest w formacie YYYY-MM-DD
            if (result.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              dateValue = result.dueDate;
            } else {
              // Spróbuj sparsować jako ISO date i przekonwertować
              const date = new Date(result.dueDate);
              if (!isNaN(date.getTime())) {
                dateValue = date.toISOString().split('T')[0];
              }
            }
          } catch (e) {
            console.warn("Failed to parse date:", result.dueDate);
          }
          form.setValue("dueDate", dateValue);
        } else {
          form.setValue("dueDate", "");
        }
        
        setShowForm(true);
        setIsAIMode(true);
      } else {
        toast.info("Nie rozpoznano zadania w tej wiadomości");
      }
    } catch (error) {
      toast.error("Błąd podczas analizowania wiadomości", {
        description: (error as Error).message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualAdd = () => {
    form.reset();
    setShowForm(true);
    setIsAIMode(false);
  };

  const onTaskSubmit = async (values: z.infer<typeof taskFormSchema>) => {
    try {
      await createTask({
        projectId,
        title: values.title,
        description: values.description,
        priority: values.priority || "medium",
        endDate: values.dueDate ? new Date(values.dueDate).getTime() : undefined,
        estimatedHours: undefined,
        tags: [],
      });

      toast.success("Zadanie zostało utworzone!");
      handleCancel();
      onTaskCreated();
    } catch (error) {
      toast.error("Błąd podczas tworzenia zadania", {
        description: (error as Error).message
      });
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setIsAIMode(false);
    form.reset();
    setMessage("");
  };

  return (
    <div className="mb-6">
      {!showForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Dodaj nowe zadanie</span>
              <div className="flex gap-2">
                <Button onClick={handleManualAdd} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Ręcznie
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Bot className="h-4 w-4 text-blue-600" />
                <span>Lub skorzystaj z asystenta AI:</span>
              </div>
              <form onSubmit={handleAISubmit} className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Napisz zadanie, np. 'dodaj task spotkanie jutro o 10'"
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={isLoading || !message.trim()}>
                  {isLoading ? (
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                {isAIMode && <Bot className="h-5 w-5 text-blue-600" />}
                {isAIMode ? "Edytuj zadanie z AI" : "Nowe zadanie"}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCancel}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onTaskSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tytuł</FormLabel>
                      <FormControl>
                        <Input placeholder="Tytuł zadania" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opis</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Opis zadania (opcjonalne)" 
                          {...field} 
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priorytet (opcjonalne)</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : value)} value={field.value || "none"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Wybierz priorytet" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Brak</SelectItem>
                            <SelectItem value="low">Niski</SelectItem>
                            <SelectItem value="medium">Średni</SelectItem>
                            <SelectItem value="high">Wysoki</SelectItem>
                            <SelectItem value="urgent">Pilny</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data wykonania</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit">
                    Utwórz zadanie
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleCancel}
                  >
                    Anuluj
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 