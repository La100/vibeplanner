"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { History } from "lucide-react";

// Helper to format activity details
const formatActivityDetails = (activity: Doc<"activityLog">) => {
  switch (activity.actionType) {
    case "task.create":
      return `created task: "${activity.details.title}"`;
    case "task.update":
      return `updated task: "${activity.details.title}"`;
    case "task.status.change":
      return `changed status of task "${activity.details.title}" from ${activity.details.from} to ${activity.details.to}`;
    case "task.delete":
      return `deleted task: "${activity.details.title}"`;
    case "task.assign":
        return `assigned task "${activity.details.title}" to ${activity.details.to === 'unassigned' ? 'no one' : activity.details.to.split('|')[1] || activity.details.to}`;
    case "task.content.update":
        return `updated the content of task: "${activity.details.title}"`;
    default:
      return `performed an action: ${activity.actionType}`;
  }
};

function ActivityItem({ activity }: { activity: Doc<"activityLog"> & { userName?: string; userImageUrl?: string } }) {
  return (
    <div className="flex items-center gap-4 p-4 border-b">
      <Avatar>
        <AvatarImage src={activity.userImageUrl} alt={activity.userName} />
        <AvatarFallback>{activity.userName?.charAt(0) ?? "?"}</AvatarFallback>
      </Avatar>
      <div className="flex-grow">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{activity.userName ?? "A user"}</span>
          {' '}
          {formatActivityDetails(activity)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(activity._creationTime), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}


export function ActivityView() {
  const params = useParams<{ slug: string; projectSlug: string }>();
  
  const project = useQuery(api.projects.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const activities = useQuery(
    api.activityLog.getForProject,
    project ? { projectId: project._id } : "skip"
  );

  if (activities === undefined || project === undefined) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  
  if (!activities || activities.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <History className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Activity Yet</h2>
            <p className="text-muted-foreground">
                When changes are made in this project, they will appear here.
            </p>
        </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
            <p className="text-muted-foreground">A log of all the recent activity in this project.</p>
        </div>
        <div className="border-t">
            {activities.map((activity) => (
                <ActivityItem key={activity._id} activity={activity} />
            ))}
        </div>
    </div>
  );
} 