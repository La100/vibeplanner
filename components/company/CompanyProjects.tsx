"use client";

import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Card, CardTitle } from "@/components/ui/card";
import { Building2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreateAssistantView } from "./CreateAssistantView";
import { getPreset } from "@/convex/ai/presets";

export default function CompanyProjects() {
  const router = useRouter();

  const team = useQuery(apiAny.teams.getMyTeam);
  const projects = useQuery(apiAny.projects.listProjectsForCurrentUser);
  const deleteProject = useMutation(apiAny.projects.deleteProject);

  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const gradientThemes = ["bg-[#002FA7]"];

  const projectIds = useMemo<string[]>(
    () => (projects ?? []).map((project: { _id: string }) => project._id),
    [projects]
  );
  const selectedCount = selectedProjectIds.size;
  const hasSelection = selectedCount > 0;

  const getGradientClass = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    const index = Math.abs(hash) % gradientThemes.length;
    return gradientThemes[index];
  };

  useEffect(() => {
    setSelectedProjectIds((prev) => {
      const next = new Set(projectIds.filter((id) => prev.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [projectIds]);

  useEffect(() => {
    if (projectIds.length === 0 && selectionMode) {
      setSelectionMode(false);
    }
  }, [projectIds.length, selectionMode]);

  const toggleSelection = (projectId: string, checked: boolean) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(projectId);
      } else {
        next.delete(projectId);
      }
      return next;
    });
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedProjectIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedProjectIds.size === 0) return;
    const count = selectedProjectIds.size;
    const confirmed = window.confirm(
      `Delete ${count} assistant${count === 1 ? "" : "s"}? This removes all tasks, files, and comments.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    const ids = Array.from(selectedProjectIds);
    const results = await Promise.allSettled(
      ids.map((projectId) => deleteProject({ projectId }))
    );
    const failedIds: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        failedIds.push(ids[index]);
      }
    });

    const successCount = ids.length - failedIds.length;
    if (successCount > 0) {
      toast.success(`Deleted ${successCount} assistant${successCount === 1 ? "" : "s"}.`);
    }
    if (failedIds.length > 0) {
      toast.error(`Failed to delete ${failedIds.length} assistant${failedIds.length === 1 ? "" : "s"}.`);
    }

    setSelectedProjectIds(new Set(failedIds));
    setIsDeleting(false);
  };

  if (!team || !projects) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      {/* Header */}
      <div className="mx-auto w-full max-w-6xl px-6 pt-10 pb-4 sm:px-10 sm:pt-14 sm:pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {isCreating ? "New Assistant" : "Assistants"}
            </h1>
            <p className="text-muted-foreground mt-1.5 text-base">
              {isCreating
                ? "Select a personality or create your own"
                : "Manage your assistants"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {isCreating ? (
              <Button
                size="lg"
                variant="outline"
                className="gap-2 w-full sm:w-auto rounded-full px-5"
                onClick={() => setIsCreating(false)}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  className="gap-2 w-full sm:w-auto rounded-full px-5 bg-foreground text-background hover:bg-foreground/90"
                  onClick={() => setIsCreating(true)}
                >
                  <Plus className="h-4 w-4" />
                  New Assistant
                </Button>
                {projects.length > 0 && (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={selectionMode ? exitSelectionMode : enterSelectionMode}
                    className="w-full sm:w-auto rounded-full px-5"
                    disabled={isDeleting}
                  >
                    {selectionMode ? "Done" : "Select"}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {!isCreating && projects.length > 0 && selectionMode && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-4">
            <span>{selectedCount} selected</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedProjectIds(new Set())}
              disabled={isDeleting || !hasSelection}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isDeleting || !hasSelection}
            >
              Delete selected
            </Button>
          </div>
        )}
      </div>

      {/* Content — transitions between list and create */}
      <AnimatePresence mode="wait">
        {isCreating ? (
          <motion.div
            key="create"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1 min-h-0"
          >
            <CreateAssistantView
              teamId={team._id}
              onCancel={() => setIsCreating(false)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1"
          >
            <div className="mx-auto w-full max-w-6xl px-6 py-6 sm:px-10 sm:py-8">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {projects.length > 0 ? (
                  projects.map(
                    (project: {
                      _id: string;
                      slug: string;
                      name: string;
                      imageUrl?: string;
                      assistantPreset?: string;
                    }) => {
                      const preset = getPreset(project.assistantPreset || "");
                      const displayImage = project.imageUrl || preset?.image;
                      const hasImage = Boolean(displayImage);
                      const isSelected = selectedProjectIds.has(project._id);

                      // Use preset gradient if available, otherwise fallback to hashed gradient
                      const gradientClass = preset?.gradient
                        ? `bg-gradient-to-br ${preset.gradient}`
                        : getGradientClass(project.slug || project._id);

                      return (
                        <Card
                          key={project._id}
                          className={cn(
                            "relative cursor-pointer transition-all duration-200 group overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm hover:shadow-md flex flex-col w-full p-0 gap-0",
                            isSelected && "ring-2 ring-foreground/30 border-foreground/30"
                          )}
                          onClick={() => {
                            if (selectionMode) {
                              toggleSelection(project._id, !isSelected);
                              return;
                            }
                            router.push(`/organisation/projects/${project.slug}`);
                          }}
                        >
                          {selectionMode && (
                            <div className="absolute left-3.5 top-3.5 z-20">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => toggleSelection(project._id, Boolean(checked))}
                                onClick={(event) => event.stopPropagation()}
                                disabled={isDeleting}
                              />
                            </div>
                          )}

                          <div className="relative w-full aspect-[3/4] overflow-hidden">
                            {hasImage ? (
                              <img
                                src={displayImage}
                                alt={project.name}
                                className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                              />
                            ) : (
                              <div className={cn("absolute inset-0", gradientClass)} />
                            )}

                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                            <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
                              <CardTitle className="text-lg font-semibold text-white drop-shadow-sm line-clamp-1">
                                {project.name}
                              </CardTitle>
                              {preset?.description && (
                                <p className="text-sm text-white/75 line-clamp-3 mt-1">
                                  {preset.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    }
                  )
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/50 py-20 sm:py-28 text-center">
                    <div className="bg-muted/60 p-5 rounded-2xl mb-5">
                      <Building2 className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1.5">No assistants yet</h3>
                    <p className="text-muted-foreground text-sm mb-7 max-w-xs text-center mx-auto">
                      Create your first assistant to start organizing tasks.
                    </p>
                    <Button
                      size="lg"
                      className="gap-2 w-full sm:w-auto rounded-full px-5 bg-foreground text-background hover:bg-foreground/90"
                      onClick={() => setIsCreating(true)}
                    >
                      <Plus className="h-5 w-5" />
                      Create Assistant
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
