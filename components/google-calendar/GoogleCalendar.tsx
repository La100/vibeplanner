"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/providers/ProjectProvider";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday
} from "date-fns";
import { pl } from "date-fns/locale";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  ExternalLink,
  Clock,
  MapPin,
  Users,
  Link2,
  Link2Off,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GoogleCalendarProps {
  className?: string;
}

interface CalendarEventData {
  _id: Id<"googleCalendarEvents">;
  googleEventId: string;
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  allDay: boolean;
  location?: string;
  attendees?: Array<{ email: string; name?: string; responseStatus?: string }>;
  htmlLink?: string;
  status?: string;
  colorId?: string;
}

export function GoogleCalendar({ className }: GoogleCalendarProps) {
  const { project, team } = useProject();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventData | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // New event form state
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    startDate: "",
    startTime: "09:00",
    endDate: "",
    endTime: "10:00",
    allDay: false,
    location: "",
    attendees: "",
  });

  // Convex queries and mutations
  const connectionStatus = useQuery(api.googleCalendarDb.getConnectionStatus, 
    team?._id ? { teamId: team._id } : "skip"
  );

  const calendarEvents = useQuery(api.googleCalendarDb.getProjectEvents, 
    project?._id ? {
      projectId: project._id,
      startDate: startOfMonth(subMonths(currentDate, 1)).getTime(),
      endDate: endOfMonth(addMonths(currentDate, 1)).getTime(),
    } : "skip"
  );

  const getAuthUrl = useAction(api.googleCalendar.getAuthUrl);
  const syncEvents = useAction(api.googleCalendar.syncEvents);
  const createEvent = useAction(api.googleCalendar.createEvent);
  const deleteEvent = useAction(api.googleCalendar.deleteGoogleEvent);
  const disconnect = useMutation(api.googleCalendarDb.disconnect);

  // Calendar navigation
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToPrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Get days for current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // Get events for a specific day
  const getEventsForDay = useCallback((day: Date) => {
    if (!calendarEvents) return [];
    
    const dayStart = new Date(day).setHours(0, 0, 0, 0);
    const dayEnd = new Date(day).setHours(23, 59, 59, 999);
    
    return calendarEvents.filter((event) => {
      const eventStart = event.startTime;
      const eventEnd = event.endTime;
      return eventStart <= dayEnd && eventEnd >= dayStart;
    });
  }, [calendarEvents]);

  // Connect to Google Calendar
  const handleConnect = async () => {
    if (!team?._id) return;
    
    setIsConnecting(true);
    try {
      const authUrl = await getAuthUrl({ teamId: team._id });
      // Open in popup
      const popup = window.open(authUrl, "google-calendar-auth", "width=600,height=700");
      
      // Listen for popup close
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          setIsConnecting(false);
        }
      }, 500);

      // Listen for success message
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "google-calendar-connected") {
          if (event.data.success) {
            toast.success("Google Calendar connected successfully!");
          }
          setIsConnecting(false);
          window.removeEventListener("message", handleMessage);
        }
      };
      window.addEventListener("message", handleMessage);
    } catch (error) {
      console.error("Error connecting to Google Calendar:", error);
      toast.error("Failed to connect to Google Calendar");
      setIsConnecting(false);
    }
  };

  // Disconnect from Google Calendar
  const handleDisconnect = async () => {
    if (!team?._id) return;
    
    try {
      await disconnect({ teamId: team._id });
      toast.success("Google Calendar disconnected");
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Failed to disconnect");
    }
  };

  // Sync events
  const handleSync = async () => {
    if (!project?._id || !team?._id) return;
    
    setIsSyncing(true);
    try {
      const result = await syncEvents({
        projectId: project._id,
        teamId: team._id,
      });
      toast.success(`Synced ${result.count} events from Google Calendar`);
    } catch (error) {
      console.error("Error syncing events:", error);
      toast.error("Failed to sync events");
    } finally {
      setIsSyncing(false);
    }
  };

  // Create new event
  const handleCreateEvent = async () => {
    if (!project?._id || !team?._id || !newEvent.title) return;

    try {
      let startTime: number;
      let endTime: number;

      if (newEvent.allDay) {
        startTime = new Date(newEvent.startDate).setHours(0, 0, 0, 0);
        endTime = new Date(newEvent.endDate || newEvent.startDate).setHours(23, 59, 59, 999);
      } else {
        const [startHour, startMin] = newEvent.startTime.split(":").map(Number);
        const [endHour, endMin] = newEvent.endTime.split(":").map(Number);
        startTime = new Date(newEvent.startDate).setHours(startHour, startMin, 0, 0);
        endTime = new Date(newEvent.endDate || newEvent.startDate).setHours(endHour, endMin, 0, 0);
      }

      const attendees = newEvent.attendees
        ? newEvent.attendees.split(",").map((e) => e.trim()).filter(Boolean)
        : undefined;

      await createEvent({
        projectId: project._id,
        teamId: team._id,
        title: newEvent.title,
        description: newEvent.description || undefined,
        startTime,
        endTime,
        allDay: newEvent.allDay,
        location: newEvent.location || undefined,
        attendees,
      });

      toast.success("Event created successfully!");
      setIsCreateDialogOpen(false);
      resetNewEventForm();
      
      // Sync to update the view
      await handleSync();
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Failed to create event");
    }
  };

  // Delete event
  const handleDeleteEvent = async (googleEventId: string) => {
    if (!team?._id) return;

    try {
      await deleteEvent({
        googleEventId,
        teamId: team._id,
      });
      toast.success("Event deleted");
      setIsEventDialogOpen(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event");
    }
  };

  // Reset new event form
  const resetNewEventForm = () => {
    setNewEvent({
      title: "",
      description: "",
      startDate: "",
      startTime: "09:00",
      endDate: "",
      endTime: "10:00",
      allDay: false,
      location: "",
      attendees: "",
    });
  };

  // Handle day click
  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setNewEvent((prev) => ({
      ...prev,
      startDate: format(day, "yyyy-MM-dd"),
      endDate: format(day, "yyyy-MM-dd"),
    }));
    setIsCreateDialogOpen(true);
  };

  // Handle event click
  const handleEventClick = (event: CalendarEventData, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setIsEventDialogOpen(true);
  };

  // Get event color based on colorId
  const getEventColor = (colorId?: string) => {
    const colors: Record<string, string> = {
      "1": "bg-blue-500",
      "2": "bg-green-500",
      "3": "bg-purple-500",
      "4": "bg-red-500",
      "5": "bg-yellow-500",
      "6": "bg-orange-500",
      "7": "bg-cyan-500",
      "8": "bg-gray-500",
      "9": "bg-indigo-500",
      "10": "bg-emerald-500",
      "11": "bg-pink-500",
    };
    return colors[colorId || "1"] || "bg-primary";
  };

  if (!connectionStatus?.isConnected) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-12 space-y-6", className)}>
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
          <CalendarIcon className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Connect Google Calendar</h2>
          <p className="text-muted-foreground max-w-md">
            Connect your Google Calendar to sync events, create meetings, and manage your schedule directly from VibePlanner.
          </p>
        </div>
        <Button onClick={handleConnect} disabled={isConnecting} size="lg" className="gap-2">
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Link2 className="w-4 h-4" />
              Connect Google Calendar
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <h2 className="text-lg font-semibold">
            {format(currentDate, "LLLL yyyy", { locale: pl })}
          </h2>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            {connectionStatus.email}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync} 
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            Sync
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => {
              setNewEvent((prev) => ({
                ...prev,
                startDate: format(new Date(), "yyyy-MM-dd"),
                endDate: format(new Date(), "yyyy-MM-dd"),
              }));
              setIsCreateDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleDisconnect}
            title="Disconnect Google Calendar"
          >
            <Link2Off className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1 flex-1">
          {calendarDays.map((day) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "min-h-[100px] p-2 border rounded-lg cursor-pointer transition-colors",
                  isCurrentMonth ? "bg-card hover:bg-accent/50" : "bg-muted/30",
                  isCurrentDay && "ring-2 ring-primary ring-offset-2"
                )}
              >
                <div className={cn(
                  "text-sm font-medium mb-1",
                  !isCurrentMonth && "text-muted-foreground",
                  isCurrentDay && "text-primary"
                )}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event._id}
                      onClick={(e) => handleEventClick(event, e)}
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80 transition-opacity",
                        getEventColor(event.colorId)
                      )}
                      title={event.title}
                    >
                      {!event.allDay && (
                        <span className="opacity-75 mr-1">
                          {format(new Date(event.startTime), "HH:mm")}
                        </span>
                      )}
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Details Dialog */}
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className={cn("w-3 h-3 rounded-full", getEventColor(selectedEvent?.colorId))} />
              {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>
                  {selectedEvent.allDay
                    ? format(new Date(selectedEvent.startTime), "d MMMM yyyy", { locale: pl })
                    : `${format(new Date(selectedEvent.startTime), "d MMMM yyyy, HH:mm", { locale: pl })} - ${format(new Date(selectedEvent.endTime), "HH:mm", { locale: pl })}`
                  }
                </span>
              </div>

              {selectedEvent.location && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}

              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className="flex items-start gap-3 text-muted-foreground">
                  <Users className="w-4 h-4 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {selectedEvent.attendees.map((attendee, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-muted rounded-full text-xs"
                      >
                        {attendee.name || attendee.email}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedEvent.description && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedEvent.description}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {selectedEvent.htmlLink && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => window.open(selectedEvent.htmlLink, "_blank")}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Google Calendar
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteEvent(selectedEvent.googleEventId)}
                >
                  Delete Event
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Event Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
            <DialogDescription>
              Add a new event to your Google Calendar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                value={newEvent.title}
                onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Enter event title"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="allDay"
                checked={newEvent.allDay}
                onCheckedChange={(checked) => setNewEvent((prev) => ({ ...prev, allDay: checked }))}
              />
              <Label htmlFor="allDay">All day event</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newEvent.startDate}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              {!newEvent.allDay && (
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={newEvent.endDate || newEvent.startDate}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              {!newEvent.allDay && (
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="location">Location (optional)</Label>
              <Input
                id="location"
                value={newEvent.location}
                onChange={(e) => setNewEvent((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Enter location"
              />
            </div>

            <div>
              <Label htmlFor="attendees">Attendees (optional)</Label>
              <Input
                id="attendees"
                value={newEvent.attendees}
                onChange={(e) => setNewEvent((prev) => ({ ...prev, attendees: e.target.value }))}
                placeholder="email1@example.com, email2@example.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separate multiple emails with commas
              </p>
            </div>

            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={newEvent.description}
                onChange={(e) => setNewEvent((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Enter event description"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateEvent} disabled={!newEvent.title || !newEvent.startDate}>
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


