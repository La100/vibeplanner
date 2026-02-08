"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { format, isValid } from "date-fns";
import {
    Type,
    AlignLeft,
    Clock,
    User,
    Tag,
    AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PendingContentItem } from "../../data/types";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";

interface InlineCreationFormProps {
    item: PendingContentItem;
    index: number;
    onConfirm: (index: number | string) => Promise<void>;
    onReject: (index: number | string) => void | Promise<void>;
    onUpdate: (index: number | string, updates: Partial<PendingContentItem>) => void;
}

export function InlineCreationForm({
    item,
    index,
    onConfirm,
    onReject,
    onUpdate,
}: InlineCreationFormProps) {
    // Determine operation from item
    const operation = item.operation || 'create';
    const operationVerb = operation === 'delete' ? 'Delete' : (operation === 'edit' || operation === 'bulk_edit') ? 'Update' : 'Create';

    // For edit operations, merge originalItem with updates to get full data
    // For create operations, use data directly
    const baseData = operation === 'edit' && item.originalItem
        ? { ...(item.originalItem as Record<string, unknown>), ...(item.updates || {}) }
        : item.data as Record<string, unknown>;

    const data = baseData;
    const title = typeof data.title === "string" ? data.title : undefined;
    const name = typeof data.name === "string" ? data.name : undefined;
    const description = typeof data.description === "string" ? data.description : undefined;
    const content = typeof data.content === "string" ? data.content : undefined;
    const displayTitle = title || name || "Untitled";
    const displayDescription = description || content;
    const { project } = useProject();
    const teamMembers = useQuery(
        apiAny.teams.getTeamMembers,
        project ? { teamId: project.teamId } : "skip"
    );
    // Determine type and label
    const type = normalizeType(item.type);

    const handleConfirm = async () => {
        await onConfirm(item.functionCall?.callId ?? index);
    };

    const updateData = (updates: Record<string, unknown>) => {
        const id = item.functionCall?.callId ?? index;
        // For edit operations, update the updates field
        // For create operations, update data field
        if (operation === 'edit') {
            onUpdate(id, {
                updates: { ...(item.updates || {}), ...updates }
            });
        } else {
            onUpdate(id, {
                data: { ...data, ...updates }
            });
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto bg-card rounded-xl border border-border shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[60vh] ring-1 ring-border/50">
            {/* Header */}
            <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <div className={cn("w-2 h-2 rounded-full", getDotColor(type))} />
                    <span>{operationVerb} {getLabel(type)}</span>
                </div>
                {operation === 'edit' && displayTitle && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{displayTitle}</span>
                )}
            </div>

            <div className="p-5 space-y-5 flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {/* Content Forms - only show for create/edit */}
                {operation === 'delete' ? (
                    <div className="space-y-3">
                        <div className="text-base font-medium">
                            {displayTitle}
                        </div>
                        {displayDescription && (
                            <div className="text-sm text-muted-foreground">
                                {displayDescription}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {type === "task" && (
                            <TaskForm
                                data={data}
                                onUpdate={updateData}
                                teamMembers={teamMembers}
                            />
                        )}
                            {type === "habit" && (
                                <HabitForm
                                    data={data}
                                    onUpdate={updateData}
                                />
                            )}

                    </>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 bg-muted/20 border-t border-border">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 pl-1">
                    {/* Optional: Status Text or Helper */}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReject(item.functionCall?.callId ?? index)}
                        className="text-muted-foreground hover:text-foreground h-9 px-3 hover:bg-muted/50"
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleConfirm}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 shadow-sm font-medium"
                    >
                        {operationVerb} {getLabel(type)}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// --- Sub-Components ---

function TaskForm({
    data,
    onUpdate,
    teamMembers,
}: {
    data: Record<string, unknown>;
    onUpdate: (u: Record<string, unknown>) => void;
    teamMembers?: Array<{ clerkUserId: string; name?: string; email?: string }>;
}) {
    const [startDate, setStartDate] = useState<Date | undefined>(() => {
        if (!data.startDate) return undefined;
        const d = new Date(String(data.startDate));
        return isValid(d) ? d : undefined;
    });
    const [endDate, setEndDate] = useState<Date | undefined>(() => {
        if (!data.endDate) return undefined;
        const d = new Date(String(data.endDate));
        return isValid(d) ? d : undefined;
    });
    const [startTime, setStartTime] = useState(startDate ? format(startDate, "HH:mm") : "11:00");
    const [endTime, setEndTime] = useState(endDate ? format(endDate, "HH:mm") : "12:00");
    const assignedToValue = data.assignedTo ? String(data.assignedTo) : "unassigned";
    const priorityValue = typeof data.priority === "string" ? data.priority : "none";
    const statusValue = typeof data.status === "string" ? data.status : "todo";

    useEffect(() => {
        if (startDate) {
            const [hours, minutes] = startTime.split(':').map(Number);
            const newDate = new Date(startDate);
            newDate.setHours(hours || 0, minutes || 0);
            if (newDate.toISOString() !== data.startDate) {
                onUpdate({ startDate: newDate.toISOString() });
            }
        }
    }, [startDate, startTime]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (endDate) {
            const [hours, minutes] = endTime.split(':').map(Number);
            const newDate = new Date(endDate);
            newDate.setHours(hours || 0, minutes || 0);
            if (newDate.toISOString() !== data.endDate) {
                onUpdate({ endDate: newDate.toISOString() });
            }
        }
    }, [endDate, endTime]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground/80 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5" />
                    Title
                </Label>
                <Input
                    value={String(data.title || data.name || "")}
                    onChange={(e) => onUpdate({ title: e.target.value })}
                    className="bg-transparent border-border/60 focus:bg-background transition-colors"
                    placeholder="Enter title"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground/80 flex items-center gap-1.5">
                    <AlignLeft className="w-3.5 h-3.5" />
                    Description
                </Label>
                <Input
                    value={String(data.description || "")}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                    className="bg-transparent border-border/60 focus:bg-background transition-colors"
                    placeholder="Add description"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground/80 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        Status
                    </Label>
                    <Select
                        value={statusValue}
                        onValueChange={(value) => onUpdate({ status: value })}
                    >
                        <SelectTrigger className="bg-transparent border-border/60 hover:bg-muted/20">
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground/80 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Priority
                    </Label>
                    <Select
                        value={priorityValue}
                        onValueChange={(value) => onUpdate({ priority: value === "none" ? undefined : value })}
                    >
                        <SelectTrigger className="bg-transparent border-border/60 hover:bg-muted/20">
                            <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No priority</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-medium text-muted-foreground/80 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Assigned To
                </Label>
                <Select
                    value={assignedToValue}
                    onValueChange={(value) => {
                        const selected = teamMembers?.find((member) => member.clerkUserId === value);
                        if (value === "unassigned") {
                            onUpdate({ assignedTo: null, assignedToName: undefined });
                            return;
                        }
                        onUpdate({
                            assignedTo: value,
                            assignedToName: selected?.name || selected?.email,
                        });
                    }}
                >
                    <SelectTrigger className="bg-transparent border-border/60 hover:bg-muted/20">
                        <SelectValue placeholder="Select a person" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {teamMembers?.map((member) => (
                            <SelectItem key={member.clerkUserId} value={member.clerkUserId}>
                                {member.name || member.email || "Unknown"}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground/80 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Start Time
                    </Label>
                    <div className="flex gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 px-2.5 truncate border-border/60", !startDate && "text-muted-foreground")}>
                                    <span className="truncate">{startDate ? format(startDate, "MMM d, yyyy") : "Pick date"}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-[88px] border-border/60" />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground/80 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        End Time
                    </Label>
                    <div className="flex gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 px-2.5 truncate border-border/60", !endDate && "text-muted-foreground")}>
                                    <span className="truncate">{endDate ? format(endDate, "MMM d, yyyy") : "Pick date"}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-[88px] border-border/60" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function HabitForm({
    data,
    onUpdate,
}: {
    data: Record<string, unknown>;
    onUpdate: (u: Record<string, unknown>) => void;
}) {
    const frequencyValue = typeof data.frequency === "string" ? data.frequency : "daily";

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground/80 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5" />
                    Name
                </Label>
                <Input
                    value={String(data.name || data.title || "")}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    className="bg-transparent border-border/60 focus:bg-background transition-colors"
                    placeholder="e.g., 100 pushups"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground/80 flex items-center gap-1.5">
                    <AlignLeft className="w-3.5 h-3.5" />
                    Description
                </Label>
                <Input
                    value={String(data.description || "")}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                    className="bg-transparent border-border/60 focus:bg-background transition-colors"
                    placeholder="Optional details"
                />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground/80 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Frequency
                    </Label>
                    <Select
                        value={frequencyValue}
                        onValueChange={(value) => onUpdate({ frequency: value })}
                    >
                        <SelectTrigger className="bg-transparent border-border/60 hover:bg-muted/20">
                            <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground/80 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Reminder
                    </Label>
                    <Input
                        type="time"
                        value={String(data.reminderTime || "")}
                        onChange={(e) => onUpdate({ reminderTime: e.target.value })}
                        className="bg-transparent border-border/60"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground/80">Target</Label>
                    <Input
                        type="number"
                        placeholder="100"
                        value={data.targetValue ? String(data.targetValue) : ""}
                        onChange={(e) => onUpdate({ targetValue: parseFloat(e.target.value) || 0 })}
                        className="bg-transparent border-border/60"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground/80">Unit</Label>
                    <Input
                        placeholder="reps, kg, days..."
                        value={String(data.unit || "")}
                        onChange={(e) => onUpdate({ unit: e.target.value })}
                        className="bg-transparent border-border/60"
                    />
                </div>
            </div>

        </div>
    );
}

// --- Helpers ---

function normalizeType(type: string): string {
    if (type.includes("workout")) return "workout";
    if (type.includes("diet")) return "diet";
    if (type.includes("habit")) return "habit";
    if (type.includes("task")) return "task";
    return "task"; // default
}

function getDotColor(type: string) {
    switch (type) {
        case "habit": return "bg-amber-500";
        case "workout": return "bg-orange-500";
        case "diet": return "bg-green-500";
        case "task": return "bg-purple-500";
        default: return "bg-gray-500";
    }
}

function getLabel(type: string) {
    switch (type) {
        case "habit": return "Habit";
        case "workout": return "Workout";
        case "diet": return "Nutrition";
        case "task": return "Task";
        default: return "Item";
    }
}
