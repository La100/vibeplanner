"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Save, Loader2, RotateCcw, Sparkles, Database, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getPreset } from "@/convex/ai/presets";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function parseMemoryItems(content: string): string[] {
  if (!content) return [];
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((item) => item.length > 0);
}

export default function SoulPage() {
  const { project } = useProject();
  const projectData = useQuery(apiAny.projects.getProject, { projectId: project._id });
  const updateProject = useMutation(apiAny.projects.updateProject);

  const memoryContent = useQuery(apiAny.ai.system.getLongTermMemory, { projectId: project._id });
  const updateMemory = useMutation(apiAny.ai.system.updateLongTermMemory);

  const [soul, setSoul] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const defaultSoul = getPreset(projectData?.assistantPreset || "custom")?.defaultSoul || "";
  const memoryItems = parseMemoryItems(memoryContent || "");

  // Initialize soul from project
  useEffect(() => {
    if (projectData?.soul !== undefined) {
      setSoul(projectData.soul || "");
      setHasChanges(false);
    }
  }, [projectData?.soul]);

  const handleSave = async () => {
    if (!project?._id) return;

    setIsSaving(true);
    try {
      await updateProject({
        projectId: project._id,
        soul,
      });
      setHasChanges(false);
      toast.success("SOUL saved successfully");
    } catch (error) {
      console.error("Failed to save SOUL:", error);
      toast.error("Failed to save SOUL");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (projectData?.soul !== undefined) {
      setSoul(projectData.soul || "");
      setHasChanges(false);
      toast.info("Changes reset");
    }
  };

  const handleResetToDefault = async () => {
    if (!project?._id) return;

    setIsSaving(true);
    try {
      await updateProject({
        projectId: project._id,
        soul: defaultSoul,
      });
      setSoul(defaultSoul);
      setHasChanges(false);
      toast.success("SOUL reset to default");
    } catch (error) {
      console.error("Failed to reset SOUL to default:", error);
      toast.error("Failed to reset SOUL to default");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (value: string) => {
    setSoul(value);
    setHasChanges(value !== (projectData?.soul || ""));
  };

  const handleRemoveMemory = async (index: number) => {
    const updated = memoryItems
      .filter((_, i) => i !== index)
      .map((item) => `- ${item}`)
      .join("\n");
    try {
      await updateMemory({ projectId: project._id, content: updated });
      toast.success("Memory item removed");
    } catch {
      toast.error("Failed to remove memory item");
    }
  };

  const handleClearAllMemory = async () => {
    try {
      await updateMemory({ projectId: project._id, content: "" });
      toast.success("All memories cleared");
    } catch {
      toast.error("Failed to clear memories");
    }
  };

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:container sm:max-w-6xl sm:py-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">SOUL Editor</h1>
              <p className="text-muted-foreground">
                Define your AI assistant's personality and behavior
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            variant="secondary"
            onClick={handleResetToDefault}
            disabled={isSaving || !defaultSoul}
            className="w-full sm:w-auto"
          >
            Reset to default
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="w-full sm:w-auto"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="px-0">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Personality
          </CardTitle>
          <CardDescription>
            Keep this short and principle-based (Clawdbot-style). Avoid example workout plans inside SOUL.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="rounded-md sm:rounded-lg border bg-background overflow-hidden">
            <Textarea
              value={soul}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="# SOUL - Health Assistant\n\nWrite principles, rules, and style."
              className="min-h-[50vh] sm:min-h-[600px] font-mono text-xs sm:text-sm resize-none border-0 focus-visible:ring-0"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="px-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Long-Term Memory
            </CardTitle>
            {memoryItems.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all memories?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all remembered facts and preferences. Your AI assistant will start fresh.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAllMemory}>
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <CardDescription>
            Facts and preferences remembered by your AI assistant
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {memoryContent === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : memoryItems.length === 0 ? (
            <div className="rounded-md sm:rounded-lg border bg-background p-6 text-center">
              <Database className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No memories yet. Your AI assistant will remember facts as you chat.
              </p>
            </div>
          ) : (
            <div className="rounded-md sm:rounded-lg border bg-background divide-y">
              {memoryItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-3 px-4 py-3 group"
                >
                  <p className="text-sm leading-relaxed">{item}</p>
                  <button
                    onClick={() => handleRemoveMemory(index)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove memory"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-0 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Tips for Writing Effective SOUL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-semibold mb-1">Define Clear Personality Traits</h4>
            <p className="text-sm text-muted-foreground">
              Describe how the assistant should communicate - formal, casual, encouraging, analytical, etc.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Set Domain Expertise</h4>
            <p className="text-sm text-muted-foreground">
              Specify areas of knowledge relevant to your project (e.g., software development, marketing, design).
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Provide Response Guidelines</h4>
            <p className="text-sm text-muted-foreground">
              Include instructions on response format, length, and structure to ensure consistency.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Use Markdown Formatting</h4>
            <p className="text-sm text-muted-foreground">
              Structure your SOUL with headers, lists, and emphasis to make it clear and organized.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
