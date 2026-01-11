"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PendingContentItem } from "@/components/AIConfirmationGrid";

interface InlineTaskFormProps {
    item: PendingContentItem;
    index: number;
    onConfirm: (index: number) => Promise<void>;
    onReject: (index: number) => void | Promise<void>;
    onUpdate: (index: number, updates: Partial<PendingContentItem>) => void;
    isProcessing?: boolean;
}

export function InlineTaskForm({
    item,
    index,
    onConfirm,
    onReject,
    onUpdate,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isProcessing = false,
}: InlineTaskFormProps) {
    const data = item.data as Record<string, unknown>;
    const [googleMeet, setGoogleMeet] = useState(false);
    const [title, setTitle] = useState(String(data.title || ""));
    const [description, setDescription] = useState(String(data.description || ""));
    const [location, setLocation] = useState(String(data.location || ""));
    const [attendees, setAttendees] = useState(String(data.attendees || ""));
    const [startDate, setStartDate] = useState<Date | undefined>(
        data.startDate ? new Date(String(data.startDate)) : undefined
    );
    const [endDate, setEndDate] = useState<Date | undefined>(
        data.endDate ? new Date(String(data.endDate)) : undefined
    );
    const [startTime, setStartTime] = useState(
        startDate ? format(startDate, "HH:mm") : "11:00"
    );
    const [endTime, setEndTime] = useState(
        endDate ? format(endDate, "HH:mm") : "12:00"
    );

    // Update parent state when local state changes
    useEffect(() => {
        // Debounce updates to avoid excessive re-renders
        const timer = setTimeout(() => {
            onUpdate(index, {
                data: {
                    ...data,
                    title,
                    description,
                    location,
                    attendees,
                    startDate: startDate ? startDate.toISOString() : undefined,
                    endDate: endDate ? endDate.toISOString() : undefined,
                    // Store times separately if needed, or combine with date
                }
            });
        }, 500);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, description, location, attendees, startDate, endDate, index]);

    const handleConfirm = async () => {
        await onConfirm(index);
    };

    return (
        <div className="w-full max-w-2xl mx-auto bg-background rounded-xl border border-border/40 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header gradient line */}
            <div className="h-1 w-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />

            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                    <span>Create:</span>
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        {title || "New Event"}
                    </span>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Event Title
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none text-base font-medium"
                            placeholder="Enter title"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Description
                        </Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                            placeholder="Add description"
                        />
                    </div>

                    <div className="flex items-center justify-between py-2">
                        <Label htmlFor="google-meet" className="text-sm font-medium text-foreground">
                            Add Google Meet
                        </Label>
                        <Switch
                            id="google-meet"
                            checked={googleMeet}
                            onCheckedChange={setGoogleMeet}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="location" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Location
                        </Label>
                        <Input
                            id="location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                            placeholder="Enter a value"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="attendees" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Attendees
                        </Label>
                        <Input
                            id="attendees"
                            value={attendees}
                            onChange={(e) => setAttendees(e.target.value)}
                            className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                            placeholder="Enter attendee email addresses..."
                        />
                    </div>

                    {/* Date Time Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Start Time
                            </Label>
                            <div className="flex items-center gap-2 border border-border/50 rounded-md p-1 bg-muted/20">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"ghost"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal h-8",
                                                !startDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startDate ? format(startDate, "MM / dd / yyyy") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={startDate}
                                            onSelect={setStartDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <div className="flex items-center gap-1 border-l border-border/50 pl-2">
                                    <Input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-24 h-8 border-0 bg-transparent focus-visible:ring-0 p-0 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                End Time
                            </Label>
                            <div className="flex items-center gap-2 border border-border/50 rounded-md p-1 bg-muted/20">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"ghost"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal h-8",
                                                !endDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {endDate ? format(endDate, "MM / dd / yyyy") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={endDate}
                                            onSelect={setEndDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <div className="flex items-center gap-1 border-l border-border/50 pl-2">
                                    <Input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-24 h-8 border-0 bg-transparent focus-visible:ring-0 p-0 text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 bg-muted/10 border-t border-border/40">
                <div className="flex items-center gap-2">
                    <Select defaultValue="always">
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
                        Create Event
                        <span className="ml-2 text-xs opacity-70 flex items-center font-normal">
                            <Command className="w-2.5 h-2.5 mr-0.5" /> ↵
                        </span>
                    </Button>
                </div>
            </div>
        </div>
    );
}
