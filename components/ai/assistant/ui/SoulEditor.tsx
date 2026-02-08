"use client";

/**
 * Soul Editor Component
 * 
 * Allows editing the project's SOUL (AI personality/instructions)
 * in a collapsible panel within the chat sidebar.
 */

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { getPreset } from "@/convex/ai/presets";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
    Brain,
    ChevronDown,
    Save,
    Loader2,
    RotateCcw,
} from "lucide-react";

interface SoulEditorProps {
    projectId: Id<"projects">;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SoulEditor({ projectId, isOpen, onOpenChange }: SoulEditorProps) {
    const project = useQuery(apiAny.projects.getProject, { projectId });
    const updateProject = useMutation(apiAny.projects.updateProject);

    const habits = useQuery(apiAny.habits.listProjectHabits, { projectId }) as
        | Array<{ completedToday?: boolean }>
        | undefined;

    const [soul, setSoul] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const completedCount = habits?.filter((h) => h.completedToday).length ?? 0;
    const totalCount = habits?.length ?? 0;

    // Initialize soul from project
    useEffect(() => {
        if (project?.soul !== undefined) {
            setSoul(project.soul || "");
            setHasChanges(false);
        }
    }, [project?.soul]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateProject({
                projectId,
                soul,
            });
            setHasChanges(false);
        } catch (error) {
            console.error("Failed to save SOUL:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const defaultSoul = getPreset(project?.assistantPreset || "custom")?.defaultSoul || "";

    const handleReset = () => {
        // Reset to last saved value (current DB value)
        if (project?.soul !== undefined) {
            setSoul(project.soul || "");
            setHasChanges(false);
        }
    };

    const handleResetToDefault = async () => {
        // Reset to preset default (overwrites DB)
        setIsSaving(true);
        try {
            await updateProject({
                projectId,
                soul: defaultSoul,
            });
            setSoul(defaultSoul);
            setHasChanges(false);
        } catch (error) {
            console.error("Failed to reset SOUL to default:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (value: string) => {
        setSoul(value);
        setHasChanges(value !== (project?.soul || ""));
    };

    return (
        <Collapsible open={isOpen} onOpenChange={onOpenChange}>
            <CollapsibleTrigger asChild>
                <Button
                    variant="ghost"
                    className="w-full justify-between h-10 px-4 text-sm font-medium"
                >
                    <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <div className="flex flex-col items-start leading-tight">
                            <span>SOUL Editor</span>
                            <span className="text-[11px] text-muted-foreground">
                                Status: {totalCount ? `${completedCount}/${totalCount} habits today` : "no habits"}
                            </span>
                        </div>
                    </div>
                    <ChevronDown
                        className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            isOpen && "rotate-180"
                        )}
                    />
                </Button>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="p-4 pt-2 space-y-3">
                    <div className="flex flex-col gap-1">
                        <p className="text-xs text-muted-foreground">
                            Define your assistant's personality and instructions.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Current project status: {totalCount ? `${completedCount}/${totalCount} habits completed today.` : "No habits yet."}
                        </p>
                    </div>

                    <div className="rounded-md sm:rounded-lg border bg-background overflow-hidden">
                        <ScrollArea className="h-[50vh] sm:h-64">
                            <Textarea
                                value={soul}
                                onChange={(e) => handleChange(e.target.value)}
                                placeholder="# SOUL - Your Assistant\n\nDefine who your assistant is and how it should behave..."
                                className="min-h-[50vh] sm:min-h-64 resize-none border-0 focus-visible:ring-0 font-mono text-xs sm:text-xs"
                            />
                        </ScrollArea>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleReset}
                                disabled={isSaving}
                                className="text-xs justify-start"
                            >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Reset
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleResetToDefault}
                                disabled={isSaving}
                                className="text-xs justify-start"
                                title="Overwrite with preset default SOUL"
                            >
                                Reset to default
                            </Button>
                        </div>

                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                            className="text-xs w-full sm:w-auto"
                        >
                            {isSaving ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                                <Save className="h-3 w-3 mr-1" />
                            )}
                            Save SOUL
                        </Button>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

export default SoulEditor;
