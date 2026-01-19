"use client";

import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  Plus
} from "lucide-react";

interface ActivityLogProps {
  taskId: Id<"tasks">;
}

const getActivityIcon = (actionType: string) => {
  switch (actionType) {
    case "task.create":
      return <Plus className="h-4 w-4 text-green-600" />;
    case "task.update":
      return <Edit3 className="h-4 w-4 text-blue-600" />;
    case "task.status.change":
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
};

const getActivityColor = (actionType: string) => {
  switch (actionType) {
    case "task.create":
      return "bg-green-50 border-green-200";
    case "task.update":
      return "bg-blue-50 border-blue-200";
    case "task.status.change":
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
};

const getActivityDescription = (actionType: string, details: Record<string, unknown>) => {
  switch (actionType) {
    case "task.create":
      return `created the task "${details.title}"`;
    case "task.update":
      const updatedFields = Array.isArray(details.updatedFields) ? details.updatedFields : [];
      const friendlyFields = updatedFields.map((field: string) => {
        switch (field) {
          case "updatedAt": return null; // Skip this internal field
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
      }).filter(Boolean); // Remove null values
      
      if (friendlyFields.length === 0) {
        return "updated the task";
      }
      return `updated ${friendlyFields.join(", ")}`;
    case "task.status.change":
      return `changed status from "${details.from}" to "${details.to}"`;
    case "task.assign":
      return `reassigned task from "${details.from}" to "${details.to}"`;
    case "task.comment.add":
      return `added a comment`;
    case "task.file.add":
      return `uploaded file "${details.fileName}"`;
    case "task.content.update":
      return `updated task description`;
    case "task.delete":
      return `deleted the task "${details.title}"`;
    default:
      return "performed an action";
  }
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

export default function ActivityLog({ taskId }: ActivityLogProps) {
  const activities = useQuery(apiAny.activityLog.getForTask, { taskId });

  if (!activities) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start space-x-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div
          key={activity._id}
          className={`relative flex items-start space-x-3 p-3 rounded-lg border ${getActivityColor(activity.actionType)}`}
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
            <div className="text-sm">
              <span className="font-medium text-gray-900">
                {activity.userName || "Unknown User"}
              </span>
              <span className="text-gray-600 ml-1">
                {getActivityDescription(activity.actionType, activity.details)}
              </span>
            </div>

            {/* Additional Details */}
            {activity.actionType === "task.status.change" && (
              <div className="mt-2 flex items-center space-x-2">
                <Badge className={getStatusBadgeColor(activity.details.from)}>
                  {activity.details.from}
                </Badge>
                <span className="text-gray-400">→</span>
                <Badge className={getStatusBadgeColor(activity.details.to)}>
                  {activity.details.to}
                </Badge>
              </div>
            )}

            {activity.actionType === "task.comment.add" && activity.details.commentPreview && (
              <div className="mt-2 p-2 bg-white/50 rounded text-xs text-gray-600 italic">
                "{activity.details.commentPreview}..."
              </div>
            )}

            {activity.actionType === "task.file.add" && (
              <div className="mt-2 flex items-center space-x-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="text-xs text-gray-600">
                  {activity.details.fileType} file
                </span>
              </div>
            )}

            {/* Timestamp */}
            <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500">
              <span>{formatDistanceToNow(new Date(activity._creationTime), { addSuffix: true })}</span>
              <span>•</span>
              <span>{new Date(activity._creationTime).toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}