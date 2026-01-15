"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import {
    Calendar as CalendarIcon,
    Command
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PendingContentItem } from "@/components/AIConfirmationGrid";
import { api } from "@/convex/_generated/api";
import { useProject } from "@/components/providers/ProjectProvider";

interface InlineCreationFormProps {
    item: PendingContentItem;
    index: number;
    onConfirm: (index: number) => Promise<void>;
    onReject: (index: number) => void | Promise<void>;
    onUpdate: (index: number, updates: Partial<PendingContentItem>) => void;
    isProcessing?: boolean;
}

export function InlineCreationForm({
    item,
    index,
    onConfirm,
    onReject,
    onUpdate,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isProcessing = false,
}: InlineCreationFormProps) {
    // Common state
    const data = item.data as Record<string, unknown>;
    const [askPreference, setAskPreference] = useState("always");
    const { project } = useProject();
    const teamMembers = useQuery(
        api.teams.getTeamMembers,
        project ? { teamId: project.teamId } : "skip"
    );

    // Determine type and label
    const type = normalizeType(item.type);

    const handleConfirm = async () => {
        await onConfirm(index);
    };

    const updateData = (updates: Record<string, unknown>) => {
        onUpdate(index, {
            data: { ...data, ...updates }
        });
    };

    // Determine operation from item
    const operation = item.operation || 'create';
    const operationVerb = operation === 'delete' ? 'Delete' : operation === 'edit' ? 'Update' : 'Create';

    return (
        <div className="w-full max-w-2xl mx-auto bg-background rounded-xl border border-border/40 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[50vh]">
            {/* Header gradient line based on type */}
            <div className={cn("h-1 w-full bg-gradient-to-r", getGradient(type))} />

            <div className="p-5 sm:p-6 space-y-5 flex-1 min-h-0 overflow-y-auto">
                {/* Header */}
                <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                    <span>{operationVerb}:</span>
                </div>

                {/* Content Forms - only show for create/edit */}
                {operation === 'delete' ? (
                    <div className="space-y-3">
                        <div className="text-base font-medium">
                            {String(data.title || data.name || "Untitled")}
                        </div>
                        {(data.description || data.content) && (
                            <div className="text-sm text-muted-foreground">
                                {String(data.description || data.content)}
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
                        {type === "note" && <NoteForm data={data} onUpdate={updateData} />}
                        {type === "shopping" && <ShoppingForm data={data} onUpdate={updateData} />}
                        {type === "contact" && <ContactForm data={data} onUpdate={updateData} />}
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 bg-muted/10 border-t border-border/40">
                <div className="flex items-center gap-2">
                    <Select value={askPreference} onValueChange={setAskPreference}>
                        <SelectTrigger className="w-[130px] h-8 text-xs border-0 bg-transparent shadow-none hover:bg-muted/50 focus:ring-0">
                            <SelectValue placeholder="Ask me" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="always">Always ask</SelectItem>
                            <SelectItem value="never">Don't ask</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReject(index)}
                        className="text-muted-foreground hover:text-foreground h-8"
                    >
                        Cancel
                        <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground flex items-center">
                            <Command className="w-2.5 h-2.5 mr-0.5" /> ⌫
                        </span>
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleConfirm}
                        className="bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 h-8 shadow-sm"
                    >
                        {operationVerb} {getLabel(type)}
                        <span className="ml-2 text-xs opacity-70 flex items-center font-normal">
                            <Command className="w-2.5 h-2.5 mr-0.5" /> ↵
                        </span>
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
    const [startDate, setStartDate] = useState<Date | undefined>(
        data.startDate ? new Date(String(data.startDate)) : undefined
    );
    const [endDate, setEndDate] = useState<Date | undefined>(
        data.endDate ? new Date(String(data.endDate)) : undefined
    );
    const [startTime, setStartTime] = useState(startDate ? format(startDate, "HH:mm") : "11:00");
    const [endTime, setEndTime] = useState(endDate ? format(endDate, "HH:mm") : "12:00");
    const assignedToValue = data.assignedTo ? String(data.assignedTo) : "unassigned";

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
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Event Title</Label>
                <Input
                    value={String(data.title || "")}
                    onChange={(e) => onUpdate({ title: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none text-base font-medium"
                    placeholder="Enter title"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</Label>
                <Input
                    value={String(data.description || "")}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="Add description"
                />
            </div>

            <div className="flex items-center justify-between py-1.5">
                <Label className="text-sm font-medium text-foreground">Add Google Meet</Label>
                <Switch checked={false} onCheckedChange={() => { }} />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</Label>
                <Input
                    value={String(data.location || "")}
                    onChange={(e) => onUpdate({ location: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="Enter a value"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attendees</Label>
                <Input
                    value={String(data.attendees || "")}
                    onChange={(e) => onUpdate({ attendees: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="Enter attendee email addresses..."
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assigned To</Label>
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
                    <SelectTrigger className="h-9 border-0 border-b border-border/50 rounded-none px-0 focus:ring-0 shadow-none">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Time</Label>
                    <div className="flex items-center gap-2 border border-border/50 rounded-md p-1 bg-muted/20">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"ghost"} className={cn("w-full justify-start text-left font-normal h-8", !startDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {startDate ? format(startDate, "MM / dd / yyyy") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <div className="flex items-center gap-1 border-l border-border/50 pl-2">
                            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-24 h-8 border-0 bg-transparent focus-visible:ring-0 p-0 text-sm" />
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End Time</Label>
                    <div className="flex items-center gap-2 border border-border/50 rounded-md p-1 bg-muted/20">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"ghost"} className={cn("w-full justify-start text-left font-normal h-8", !endDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {endDate ? format(endDate, "MM / dd / yyyy") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <div className="flex items-center gap-1 border-l border-border/50 pl-2">
                            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-24 h-8 border-0 bg-transparent focus-visible:ring-0 p-0 text-sm" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function NoteForm({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void }) {
    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</Label>
                <Input
                    value={String(data.title || "")}
                    onChange={(e) => onUpdate({ title: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none text-base font-medium"
                    placeholder="Note title"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Content</Label>
                <Textarea
                    value={String(data.content || "")}
                    onChange={(e) => onUpdate({ content: e.target.value })}
                    className="min-h-[120px] resize-none border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="Type your note here..."
                />
            </div>
        </div>
    );
}

function ShoppingForm({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void }) {
    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item Name</Label>
                <Input
                    value={String(data.name || "")}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none text-base font-medium"
                    placeholder="e.g. Milk"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quantity</Label>
                    <Input
                        type="number"
                        value={Number(data.quantity || 1)}
                        onChange={(e) => onUpdate({ quantity: Number(e.target.value) })}
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price (Optional)</Label>
                    <Input
                        type="number"
                        value={Number(data.unitPrice || "")}
                        onChange={(e) => onUpdate({ unitPrice: e.target.value ? Number(e.target.value) : undefined })}
                        placeholder="0.00"
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</Label>
                <Input
                    value={String(data.category || "")}
                    onChange={(e) => onUpdate({ category: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="e.g. Dairy"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</Label>
                <Input
                    value={String(data.notes || "")}
                    onChange={(e) => onUpdate({ notes: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="Add details..."
                />
            </div>
        </div>
    );
}

function ContactForm({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void }) {
    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Name</Label>
                <Input
                    value={String(data.name || "")}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none text-base font-medium"
                    placeholder="e.g. John Doe"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</Label>
                <Input
                    value={String(data.email || "")}
                    onChange={(e) => onUpdate({ email: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="john@example.com"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</Label>
                <Input
                    value={String(data.phone || "")}
                    onChange={(e) => onUpdate({ phone: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="+1 234 567 890"
                />
            </div>
        </div>
    );
}


// --- Helpers ---

function normalizeType(type: string): string {
    if (type.includes("task")) return "task";
    if (type.includes("note")) return "note";
    if (type.includes("shopping")) return "shopping";
    if (type.includes("contact")) return "contact";
    return "task";
}

function getGradient(type: string) {
    switch (type) {
        case "task": return "from-pink-500 via-purple-500 to-indigo-500";
        case "note": return "from-yellow-400 via-orange-500 to-red-500";
        case "shopping": return "from-green-400 via-emerald-500 to-teal-600";
        case "contact": return "from-blue-400 via-cyan-500 to-sky-600";
        default: return "from-gray-400 to-gray-600";
    }
}

function getLabel(type: string) {
    switch (type) {
        case "task": return "Item";
        case "note": return "Note";
        case "shopping": return "Item";
        case "contact": return "Contact";
        default: return "Item";
    }
}
