"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertTriangle, Calendar, TrendingUp } from "lucide-react";

export default function ProjectOverview() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  
  const project = useQuery(api.myFunctions.getProjectBySlug, 
    { teamSlug: params.slug, projectSlug: params.projectSlug }
  );
  
  const hasAccess = useQuery(api.myFunctions.checkUserProjectAccess, 
    project ? { projectId: project._id } : "skip"
  );
  
  const tasks = useQuery(api.myFunctions.listProjectTasks, 
    project && hasAccess ? { projectId: project._id } : "skip"
  );

  if (project === undefined || hasAccess === undefined) {
    return <div>Loading project details...</div>;
  }

  if (project === null) {
    return <div>Project not found.</div>;
  }

  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to view this project.</p>
      </div>
    );
  }

  if (tasks === undefined) {
    return <div>Loading project details...</div>;
  }
  
  const progress = tasks.length > 0 ? (tasks.filter(t => t.status === "completed").length / tasks.length) * 100 : 0;
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const inProgressTasks = tasks.filter(t => t.status === "in_progress").length;
  const overdueTasks = tasks.filter(t => t.endDate && t.endDate < Date.now() && t.status !== "completed").length;
  const upcomingTasks = tasks.filter(t => {
    if (!t.endDate || t.status === "completed") return false;
    const endDate = new Date(t.endDate);
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return endDate >= now && endDate <= nextWeek;
  }).length;

  const statusColors = {
    planning: "bg-gray-100 text-gray-800",
    active: "bg-green-100 text-green-800",
    on_hold: "bg-yellow-100 text-yellow-800",
    completed: "bg-blue-100 text-blue-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Project Overview</h1>
        <p className="text-muted-foreground">A summary of {project.name}.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Project Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={statusColors[project.status as keyof typeof statusColors]}>
              {project.status.replace("_", " ").toUpperCase()}
            </Badge>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xl font-bold">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold">{tasks.length}</span>
              <span className="text-sm text-muted-foreground">tasks</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Due Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg font-semibold">
                {project.endDate ? new Date(project.endDate).toLocaleDateString() : "Not set"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-2xl font-bold text-red-600">{overdueTasks}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Due This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              <span className="text-2xl font-bold text-orange-600">{upcomingTasks}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tasks
              .sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0))
              .slice(0, 5)
              .map(task => (
                <div key={task._id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{task.title}</h4>
                    {task.description && (
                      <p className="text-sm text-muted-foreground truncate">{task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {task.endDate && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(task.endDate).toLocaleDateString()}
                      </span>
                    )}
                    <Badge variant="outline">
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            
            {tasks.length === 0 && (
              <p className="text-muted-foreground text-center py-8">
                No tasks yet. Create your first task to get started.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 