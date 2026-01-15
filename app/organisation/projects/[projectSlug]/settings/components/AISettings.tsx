"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Trash2,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  Loader2,
  FileText,
  RotateCcw
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { defaultPrompt } from "@/convex/ai/prompt";

interface AISettingsProps {
  projectId: Id<"projects">;
}

export default function AISettings({ projectId }: AISettingsProps) {
  const { user } = useUser();
  const [isClearing, setIsClearing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Get project data
  const project = useQuery(apiAny.projects.getProject, projectId ? { projectId } : "skip");

  // Get user threads for this project
  const userThreads = useQuery(
    apiAny.ai.threads.listThreadsForUser,
    projectId && user?.id
      ? { projectId, userClerkId: user.id }
      : "skip"
  );

  // Mutation to clear all threads
  const clearAllThreads = useMutation(apiAny.ai.threads.clearAllThreadsForUser);

  // Mutation to update project settings
  const updateProject = useMutation(apiAny.projects.updateProject);

  // Initialize custom prompt from project data
  useEffect(() => {
    if (project?.customAiPrompt !== undefined) {
      // If project has custom prompt, use it. Otherwise, use default prompt.
      setCustomPrompt(project.customAiPrompt || defaultPrompt);
    }
  }, [project?.customAiPrompt]);

  const threadCount = userThreads?.length ?? 0;
  const hasThreads = threadCount > 0;

  const handleSaveCustomPrompt = async () => {
    if (!projectId) return;

    setIsSaving(true);
    try {
      // Save as custom prompt only if different from default, otherwise save as undefined
      const promptToSave = customPrompt.trim() === defaultPrompt ? undefined : customPrompt.trim();
      await updateProject({
        projectId,
        customAiPrompt: promptToSave,
      });
      toast.success("Zapisano niestandardowy prompt AI");
    } catch (error) {
      console.error("Failed to save custom AI prompt:", error);
      toast.error("Nie udało się zapisać promptu");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setCustomPrompt(defaultPrompt);
  };

  const handleClearAllHistory = async () => {
    if (!projectId || !user?.id) return;

    setIsClearing(true);
    try {
      const result = await clearAllThreads({
        projectId,
        userClerkId: user.id,
      });
      toast.success(`Usunięto ${result.removedThreads} konwersacji AI`);
      setDialogOpen(false);
    } catch (error) {
      console.error("Failed to clear AI history:", error);
      toast.error("Nie udało się usunąć historii AI");
    } finally {
      setIsClearing(false);
    }
  };

  const isCustomPromptChanged = customPrompt !== (project?.customAiPrompt || defaultPrompt);

  return (
    <div className="space-y-6">
      {/* AI Overview Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg lg:text-xl">AI Assistant</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Zarządzaj ustawieniami asystenta AI dla tego projektu.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Historia konwersacji</p>
                <p className="text-sm text-muted-foreground">
                  {userThreads === undefined ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Ładowanie...
                    </span>
                  ) : (
                    <>
                      {threadCount} {threadCount === 1 ? "konwersacja" : threadCount < 5 ? "konwersacje" : "konwersacji"}
                    </>
                  )}
                </p>
              </div>
            </div>
            {hasThreads && (
              <Badge variant="secondary" className="text-xs">
                Aktywne
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Custom AI Prompt Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg lg:text-xl">Niestandardowy prompt AI</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Dostosuj sposób, w jaki asystent AI odpowiada w tym projekcie. Pozostaw puste, aby użyć domyślnego promptu.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customPrompt" className="text-sm font-medium">
              Custom Prompt
            </Label>
            <Textarea
              id="customPrompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={12}
              className="font-mono text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {customPrompt.trim() === defaultPrompt ? (
                <>Używasz domyślnego promptu systemu ({defaultPrompt.length} znaków)</>
              ) : (
                <>Używasz niestandardowego promptu ({customPrompt.length} znaków)</>
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleSaveCustomPrompt}
              disabled={isSaving || !isCustomPromptChanged}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zapisywanie...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Zapisz prompt
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleResetToDefault}
              disabled={customPrompt.trim() === defaultPrompt}
              className="flex-1 sm:flex-initial"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Przywróć domyślny
            </Button>
          </div>

          {customPrompt.trim() && customPrompt.trim() !== defaultPrompt && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Uwaga:</strong> Używasz niestandardowego promptu. Zmiana wpłynie tylko na nowe konwersacje. Istniejące konwersacje będą nadal używać poprzedniego promptu.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone Card */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive text-lg lg:text-xl">Strefa niebezpieczna</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Nieodwracalne akcje związane z AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6 space-y-4">
          <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-medium text-destructive">Usuń całą historię czatu AI</h4>
                <p className="text-sm text-muted-foreground">
                  Trwale usuwa wszystkie konwersacje z asystentem AI w tym projekcie.
                  Ta operacja jest nieodwracalna.
                </p>
              </div>
              <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    disabled={!hasThreads || isClearing}
                    className="shrink-0"
                  >
                    {isClearing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Usuwanie...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Usuń historię
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Czy na pewno chcesz usunąć historię?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ta akcja jest nieodwracalna. Wszystkie {threadCount} konwersacji z asystentem AI 
                      w tym projekcie zostaną trwale usunięte.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isClearing}>Anuluj</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAllHistory}
                      disabled={isClearing}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isClearing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Usuwanie...
                        </>
                      ) : (
                        "Tak, usuń wszystko"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


