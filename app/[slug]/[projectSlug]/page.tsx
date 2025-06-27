"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock } from "lucide-react";
import { InviteClientForm } from "@/components/InviteClientForm";

export default function ProjectOverviewPage() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  
  const project = useQuery(api.myFunctions.getProjectBySlug, 
    { teamSlug: params.slug, projectSlug: params.projectSlug }
  );
  
  const tasks = useQuery(api.myFunctions.listProjectTasks, 
    project ? { projectId: project._id } : "skip"
  );

  if (project === undefined || tasks === undefined) {
    return <div>Loading project details...</div>;
  }

  if (project === null) {
    return <div>Project not found.</div>;
  }
  
  const progress = tasks.length > 0 ? (tasks.filter(t => t.status === "completed").length / tasks.length) * 100 : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Project Overview</h1>
        <p className="text-muted-foreground">A summary of {project.name}.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Project Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">{project.status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="w-full bg-muted rounded-full h-2.5">
                <div className="bg-primary h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
              </div>
              <span className="text-sm font-medium">{Math.round(progress)}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-primary" />
              {tasks.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Due Date</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold flex items-center gap-2">
               <Clock className="h-6 w-6 text-muted-foreground" />
              {project.endDate ? new Date(project.endDate).toLocaleDateString() : "Not set"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Invite a Client</CardTitle>
            <CardDescription>
              Invite a client to view this project. They will only have access to this project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteClientForm projectId={project._id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
