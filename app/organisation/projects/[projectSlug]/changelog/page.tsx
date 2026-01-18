"use client";

import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import {
  FileText,
  Edit3,
  Users,
  MessageCircle,
  Upload,
  CheckCircle2,
  Clock,
  Trash,
  Plus,
  History,
  ShoppingCart,
  StickyNote,
  Contact,
  ClipboardList,
  Filter,
  Calendar as CalendarIcon,
  Hammer
} from "lucide-react";
import { Suspense, useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

function ChangelogSkeleton() {
  return (
    <div className="px-4 lg:px-0 space-y-4">
      <Skeleton className="h-9 w-1/3 mb-2" />
      <Skeleton className="h-5 w-1/2 mb-6" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-start space-x-3 p-4 animate-pulse">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

const getActivityIcon = (actionType: string) => {
  if (actionType.startsWith("task.")) {
    switch (actionType) {
      case "task.create":
        return <Plus className="h-4 w-4 text-green-600" />;
      case "task.update":
        return <Edit3 className="h-4 w-4 text-blue-600" />;
      case "task.status.change":
      case "task.status_change":
        return <CheckCircle2 className="h-4 w-4 text-orange-600" />;
      case "task.assign":
        return <Users className="h-4 w-4 text-purple-600" />;
      case "task.comment.add":
        return <MessageCircle className="h-4 w-4 text-indigo-600" />;
      case "task.file.add":
        return <Upload className="h-4 w-4 text-teal-600" />;
      case "task.content.update":
        return <FileText className="h-4 w-4 text-amber-600" />;
      case "task.delete":
        return <Trash className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  }

  if (actionType.startsWith("shopping.")) {
    return <ShoppingCart className="h-4 w-4 text-emerald-600" />;
  }

  if (actionType.startsWith("labor.")) {
    return <Hammer className="h-4 w-4 text-orange-600" />;
  }

  if (actionType.startsWith("note.")) {
    return <StickyNote className="h-4 w-4 text-yellow-600" />;
  }

  if (actionType.startsWith("contact.")) {
    return <Contact className="h-4 w-4 text-cyan-600" />;
  }

  if (actionType.startsWith("survey.")) {
    return <ClipboardList className="h-4 w-4 text-pink-600" />;
  }

  return <Clock className="h-4 w-4 text-gray-600" />;
};

const getActivityColor = (actionType: string) => {
  if (actionType.startsWith("task.")) {
    switch (actionType) {
      case "task.create":
        return "bg-green-50 border-green-200";
      case "task.update":
        return "bg-blue-50 border-blue-200";
      case "task.status.change":
      case "task.status_change":
        return "bg-orange-50 border-orange-200";
      case "task.assign":
        return "bg-purple-50 border-purple-200";
      case "task.comment.add":
        return "bg-indigo-50 border-indigo-200";
      case "task.file.add":
        return "bg-teal-50 border-teal-200";
      case "task.content.update":
        return "bg-amber-50 border-amber-200";
      case "task.delete":
        return "bg-red-50 border-red-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  }

  if (actionType.startsWith("shopping.")) {
    return "bg-emerald-50 border-emerald-200";
  }

  if (actionType.startsWith("labor.")) {
    return "bg-orange-50 border-orange-200";
  }

  if (actionType.startsWith("note.")) {
    return "bg-yellow-50 border-yellow-200";
  }

  if (actionType.startsWith("contact.")) {
    return "bg-cyan-50 border-cyan-200";
  }

  if (actionType.startsWith("survey.")) {
    return "bg-pink-50 border-pink-200";
  }

  return "bg-gray-50 border-gray-200";
};

const getActivityDescription = (actionType: string, details: Record<string, unknown>) => {
  // Task activities
  if (actionType.startsWith("task.")) {
    switch (actionType) {
      case "task.create":
        return `created the task "${details.title}"`;
      case "task.update":
        const updatedFields = Array.isArray(details.updatedFields) ? details.updatedFields : [];
        const friendlyFields = updatedFields.map((field: string) => {
          switch (field) {
            case "updatedAt": return null;
            case "title": return "title";
            case "description": return "description";
            case "status": return "status";
            case "priority": return "priority";
            case "assignedTo": return "assignee";
            case "dueDate": return "due date";
            case "tags": return "tags";
            case "cost": return "cost";
            case "content": return "content";
            default: return field;
          }
        }).filter(Boolean);

        if (friendlyFields.length === 0) {
          return "updated the task";
        }
        return `updated ${friendlyFields.join(", ")} in task "${details.title || 'Untitled'}"`;
      case "task.status.change":
      case "task.status_change":
        return `changed task "${details.title || 'Untitled'}" status from "${details.fromStatus || details.from}" to "${details.toStatus || details.to}"`;
      case "task.assign":
        return `reassigned task "${details.title || 'Untitled'}" from "${details.from}" to "${details.to}"`;
      case "task.comment.add":
        return `added a comment to "${details.title || 'Untitled'}"`;
      case "task.file.add":
        return `uploaded file "${details.fileName}" to task "${details.title || 'Untitled'}"`;
      case "task.content.update":
        return `updated task "${details.title || 'Untitled'}" description`;
      case "task.delete":
        return `deleted the task "${details.title}"`;
      default:
        return "performed a task action";
    }
  }

  // Shopping list activities
  if (actionType.startsWith("shopping.")) {
    switch (actionType) {
      case "shopping.create":
        return `added "${details.name}" to shopping list`;
      case "shopping.update":
        return `updated shopping list item "${details.name}"`;
      case "shopping.cancel":
        return `cancelled shopping list item "${details.name}"`;
      case "shopping.delete":
        return `deleted "${details.name}" from shopping list`;
      default:
        return "performed a shopping list action";
    }
  }

  // Labor activities
  if (actionType.startsWith("labor.")) {
    switch (actionType) {
      case "labor.create":
        return `added labor item "${details.name || details.description || 'Unnamed'}"`;
      case "labor.update":
        return `updated labor item "${details.name || details.description || 'Unnamed'}"`;
      case "labor.delete":
        return `deleted labor item "${details.name || details.description || 'Unnamed'}"`;
      default:
        return "performed a labor action";
    }
  }

  // Note activities
  if (actionType.startsWith("note.")) {
    switch (actionType) {
      case "note.create":
        return `created note "${details.title}"`;
      case "note.update":
        return `updated note "${details.title}"`;
      case "note.delete":
        return `deleted note "${details.title}"`;
      default:
        return "performed a note action";
    }
  }

  // Contact activities
  if (actionType.startsWith("contact.")) {
    switch (actionType) {
      case "contact.create":
        return `added contact "${details.name}"`;
      case "contact.update":
        return `updated contact "${details.name}"`;
      case "contact.archive":
        return `archived contact "${details.name}"`;
      case "contact.delete":
        return `deleted contact "${details.name}"`;
      default:
        return "performed a contact action";
    }
  }

  // Survey activities
  if (actionType.startsWith("survey.")) {
    switch (actionType) {
      case "survey.create":
        return `created survey "${details.title}"`;
      case "survey.update":
        return `updated survey "${details.title}"`;
      case "survey.delete":
        return `deleted survey "${details.title}"`;
      case "survey.question.create":
        return `added question to survey "${details.surveyTitle}"`;
      case "survey.question.update":
        return `updated question in survey "${details.surveyTitle}"`;
      case "survey.question.delete":
        return `deleted question from survey "${details.surveyTitle}"`;
      default:
        return "performed a survey action";
    }
  }

  return "performed an action";
};

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case "todo":
      return "bg-gray-100 text-gray-700";
    case "in_progress":
      return "bg-blue-100 text-blue-700";
    case "review":
      return "bg-purple-100 text-purple-700";
    case "done":
      return "bg-green-100 text-green-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const getEntityTypeLabel = (actionType: string) => {
  if (actionType.startsWith("task.")) return "Task";
  if (actionType.startsWith("shopping.")) return "Shopping";
  if (actionType.startsWith("labor.")) return "Labor";
  if (actionType.startsWith("note.")) return "Note";
  if (actionType.startsWith("contact.")) return "Contact";
  if (actionType.startsWith("survey.")) return "Survey";
  return "Other";
};

function ChangelogContent() {
  const { project } = useProject();
  const [filterType, setFilterType] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");

  const hasAccess = useQuery(apiAny.projects.checkUserProjectAccess, {
    projectId: project._id,
  });

  const activities = useQuery(
    apiAny.activityLog.getForProject,
    hasAccess ? { projectId: project._id } : "skip"
  );

  const filteredActivities = useMemo(() => {
    if (!activities) return [];

    let filtered = activities;

    // Filter by entity type
    if (filterType !== "all") {
      filtered = filtered.filter(activity =>
        activity.actionType.startsWith(filterType + ".")
      );
    }

    // Filter by time
    if (timeFilter !== "all") {
      const now = Date.now();
      const filterTime = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
      }[timeFilter];

      if (filterTime) {
        filtered = filtered.filter(activity =>
          (now - activity._creationTime) <= filterTime
        );
      }
    }

    return filtered;
  }, [activities, filterType, timeFilter]);

  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to view this project's changelog.</p>
      </div>
    );
  }

  if (!activities) {
    return <ChangelogSkeleton />;
  }

  return (
    <div className="px-4 lg:px-0">
      <div className="mb-4 lg:mb-6">
        <div className="flex items-center gap-2 mb-2">
          <History className="h-8 w-8 text-primary" />
          <h1 className="text-2xl lg:text-3xl font-bold">Project Changelog</h1>
        </div>
        <p className="text-muted-foreground text-sm lg:text-base">
          Complete activity history for {project.name}
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <div className="flex flex-wrap gap-3 flex-1">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="task">Tasks</SelectItem>
                  <SelectItem value="shopping">Shopping List</SelectItem>
                  <SelectItem value="labor">Labor</SelectItem>
                  <SelectItem value="note">Notes</SelectItem>
                  <SelectItem value="contact">Contacts</SelectItem>
                  <SelectItem value="survey">Surveys</SelectItem>
                </SelectContent>
              </Select>

              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>

              {(filterType !== "all" || timeFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterType("all");
                    setTimeFilter("all");
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              {filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity List */}
      {filteredActivities.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No activity found</p>
              <p className="text-sm mt-1">
                {filterType !== "all" || timeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Activity will appear here as team members work on the project"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((activity) => (
            <div
              key={activity._id}
              className={`relative flex items-start space-x-3 p-4 rounded-lg border transition-all hover:shadow-md ${getActivityColor(activity.actionType)}`}
            >
              {/* Activity Icon */}
              <div className="flex-shrink-0 mt-1">
                {getActivityIcon(activity.actionType)}
              </div>

              {/* User Avatar */}
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={activity.userImageUrl} />
                <AvatarFallback className="text-xs">
                  {activity.userName?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>

              {/* Activity Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm flex-1">
                    <span className="font-medium text-gray-900">
                      {activity.userName || "Unknown User"}
                    </span>
                    <span className="text-gray-600 ml-1">
                      {getActivityDescription(activity.actionType, activity.details)}
                    </span>
                  </div>

                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {getEntityTypeLabel(activity.actionType)}
                  </Badge>
                </div>

                {/* Status Change Details */}
                {(activity.actionType === "task.status.change" || activity.actionType === "task.status_change") && (
                  <div className="mt-2 flex items-center space-x-2">
                    <Badge className={getStatusBadgeColor((activity.details.fromStatus || activity.details.from) as string)}>
                      {(activity.details.fromStatus || activity.details.from) as string}
                    </Badge>
                    <span className="text-gray-400">→</span>
                    <Badge className={getStatusBadgeColor((activity.details.toStatus || activity.details.to) as string)}>
                      {(activity.details.toStatus || activity.details.to) as string}
                    </Badge>
                  </div>
                )}

                {/* Comment Preview */}
                {activity.actionType === "task.comment.add" && activity.details.commentPreview && (
                  <div className="mt-2 p-2 bg-white/50 rounded text-xs text-gray-600 italic">
                    "{activity.details.commentPreview}..."
                  </div>
                )}

                {/* File Details */}
                {activity.actionType === "task.file.add" && (
                  <div className="mt-2 flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-xs text-gray-600">
                      {activity.details.fileType} file
                    </span>
                  </div>
                )}

                {/* Timestamp */}
                <div className="mt-2 flex items-center space-x-2 text-xs text-gray-500">
                  <CalendarIcon className="h-3 w-3" />
                  <span>{formatDistanceToNow(new Date(activity._creationTime), { addSuffix: true })}</span>
                  <span>•</span>
                  <span>{new Date(activity._creationTime).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show total count at bottom */}
      {filteredActivities.length > 0 && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Showing {filteredActivities.length} of {activities.length} total activities
        </div>
      )}
    </div>
  );
}

export default function ChangelogPage() {
  return (
    <Suspense fallback={<ChangelogSkeleton />}>
      <ChangelogContent />
    </Suspense>
  );
}
