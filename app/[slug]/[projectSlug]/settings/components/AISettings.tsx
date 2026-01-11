"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  Trash2, 
  MessageSquare, 
  Sparkles, 
  AlertTriangle,
  Loader2
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

interface AISettingsProps {
  projectId: Id<"projects">;
}

export default function AISettings({ projectId }: AISettingsProps) {
  const { user } = useUser();
  const [isClearing, setIsClearing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Get user threads for this project
  const userThreads = useQuery(
    api.ai.threads.listThreadsForUser,
    projectId && user?.id
      ? { projectId, userClerkId: user.id }
      : "skip"
  );

  // Mutation to clear all threads
  const clearAllThreads = useMutation(api.ai.threads.clearAllThreadsForUser);

  const threadCount = userThreads?.length ?? 0;
  const hasThreads = threadCount > 0;

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


