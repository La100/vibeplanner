"use client";

import { useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { Download, Calendar, DollarSign, BarChart3, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CompanyReports() {
  const { organization, isLoaded } = useOrganization();
  const [timeRange, setTimeRange] = useState<string>("30d");
  
  // Check if team exists first
  const team = useQuery(api.teams.getTeamByClerkOrg, 
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );
  
  // Get projects for this organization
  const projects = useQuery(api.projects.listProjectsByClerkOrg, 
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );
  
  // Get team tasks for overview
  const teamTasks = useQuery(api.tasks.listTeamTasks,
    team && team._id ? { teamId: team._id } : "skip"
  );

  // Get shopping list items for financial data
  const shoppingItems = useQuery(api.shopping.getShoppingListItemsByTeam,
    team && team._id ? { teamId: team._id } : "skip"
  );

  if (!isLoaded || !organization) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Calculate metrics
  const totalProjects = projects?.length || 0;
  const activeProjects = projects?.filter(p => p.status === "active").length || 0;
  const totalBudget = projects?.reduce((sum, p) => sum + (p.budget || 0), 0) || 0;

  const totalTasks = teamTasks?.length || 0;
  const completedTasks = teamTasks?.filter(task => task.status === "done").length || 0;
  const inProgressTasks = teamTasks?.filter(task => task.status === "in_progress").length || 0;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const totalTaskCost = teamTasks?.reduce((sum, task) => sum + (task.cost || 0), 0) || 0;

  // Shopping list costs
  const totalShoppingCost = shoppingItems?.reduce((sum, item) => sum + (item.totalPrice || 0), 0) || 0;
  const orderedShoppingCost = shoppingItems
    ?.filter(item => ["ORDERED", "IN_TRANSIT", "DELIVERED", "COMPLETED"].includes(item.realizationStatus))
    .reduce((sum, item) => sum + (item.totalPrice || 0), 0) || 0;

  // Overdue tasks
  const now = Date.now();
  const overdueTasks = teamTasks?.filter(task => {
    const taskEndDate = task.endDate || task.startDate;
    return taskEndDate && taskEndDate < now && task.status !== "done";
  }).length || 0;

  // Group projects by status
  const projectsByStatus = projects?.reduce((acc, project) => {
    const status = project.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Group tasks by status
  const tasksByStatus = teamTasks?.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports & Analytics</h1>
        
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 3 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalProjects}</div>
                  <p className="text-xs text-muted-foreground">
                    {activeProjects} active
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalBudget.toLocaleString()} $</div>
                  <p className="text-xs text-muted-foreground">
                    Across all projects
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tasks Progress</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completionRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {completedTasks} done, {inProgressTasks} in progress
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overdueTasks}</div>
                  <p className="text-xs text-muted-foreground">
                    {overdueTasks > 0 ? (
                      <span className="text-red-600">Require attention</span>
                    ) : (
                      <span className="text-green-600">All on track</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Active Projects</CardTitle>
                  <CardDescription>Currently in progress</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {projects && projects.filter(p => p.status === "active").length > 0 ? (
                      projects
                        .filter(p => p.status === "active")
                        .slice(0, 5)
                        .map(project => {
                          const projectTasks = teamTasks?.filter(t => t.projectId === project._id) || [];
                          const completedCount = projectTasks.filter(t => t.status === "done").length;
                          const progress = projectTasks.length > 0 ? (completedCount / projectTasks.length) * 100 : 0;

                          return (
                            <div key={project._id} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">{project.name}</p>
                                <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-1.5">
                                <div
                                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No active projects
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Task Priority</CardTitle>
                  <CardDescription>Tasks by priority level</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {["urgent", "high", "medium", "low"].map(priority => {
                      const count = teamTasks?.filter(t => t.priority === priority && t.status !== "done").length || 0;
                      if (count === 0) return null;

                      return (
                        <div key={priority} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              priority === "urgent" ? "destructive" :
                              priority === "high" ? "default" :
                              "secondary"
                            }>
                              {priority.toUpperCase()}
                            </Badge>
                          </div>
                          <span className="text-sm font-medium">{count} tasks</span>
                        </div>
                      );
                    })}
                    {!teamTasks?.some(t => t.priority && t.status !== "done") && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No prioritized tasks
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Status Distribution</CardTitle>
                <CardDescription>Breakdown of projects by their current status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(projectsByStatus).map(([status, count]) => {
                    const numCount = count as number;
                    return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          status === "completed" ? "default" :
                          status === "active" ? "secondary" :
                          "outline"
                        }>
                          {status.toUpperCase()}
                        </Badge>
                        <span className="text-sm">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${totalProjects > 0 ? (numCount / totalProjects) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium w-8">{numCount}</span>
                      </div>
                    </div>
                  )})}
                </div>
              </CardContent>
            </Card>

            {/* Projects List */}
            <Card>
              <CardHeader>
                <CardTitle>All Projects</CardTitle>
                <CardDescription>Overview of all team projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projects && projects.length > 0 ? (
                    projects
                      .sort((a, b) => b._creationTime - a._creationTime)
                      .map(project => {
                        const projectTasks = teamTasks?.filter(t => t.projectId === project._id) || [];
                        const completedCount = projectTasks.filter(t => t.status === "done").length;
                        const progress = projectTasks.length > 0 ? (completedCount / projectTasks.length) * 100 : 0;

                        return (
                          <div key={project._id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold">{project.name}</h4>
                                {project.customer && (
                                  <p className="text-sm text-muted-foreground">{project.customer}</p>
                                )}
                              </div>
                              <Badge variant={
                                project.status === "completed" ? "default" :
                                project.status === "active" ? "secondary" :
                                project.status === "on_hold" ? "outline" :
                                "outline"
                              }>
                                {project.status}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-medium">{Math.round(progress)}%</span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{projectTasks.length} tasks</span>
                                {project.budget && <span>Budget: {project.budget.toLocaleString()} {project.currency || 'USD'}</span>}
                                {project.startDate && (
                                  <span>Start: {new Date(project.startDate).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No projects yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Task Status Breakdown</CardTitle>
                <CardDescription>Current status of all tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(tasksByStatus).map(([status, count]) => {
                    const statusLabels: Record<string, string> = {
                      "todo": "To Do",
                      "in_progress": "In Progress",
                      "review": "Review",
                      "done": "Done"
                    };

                    const getStatusStyle = (status: string) => {
                      switch(status) {
                        case "done":
                          return { variant: "default" as const, className: "" };
                        case "in_progress":
                          return { variant: "secondary" as const, className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200" };
                        case "review":
                          return { variant: "secondary" as const, className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200" };
                        case "todo":
                          return { variant: "outline" as const, className: "" };
                        default:
                          return { variant: "outline" as const, className: "" };
                      }
                    };

                    const statusStyle = getStatusStyle(status);

                    return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={statusStyle.variant}
                          className={statusStyle.className}
                        >
                          {statusLabels[status] || status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${totalTasks > 0 ? (count / totalTasks) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium w-8">{count}</span>
                      </div>
                    </div>
                  )})}
                </div>
              </CardContent>
            </Card>

            {/* Overdue Tasks List */}
            {overdueTasks > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    Overdue Tasks
                  </CardTitle>
                  <CardDescription>Tasks that need immediate attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {teamTasks
                      ?.filter(task => {
                        const taskEndDate = task.endDate || task.startDate;
                        return taskEndDate && taskEndDate < now && task.status !== "done";
                      })
                      .sort((a, b) => {
                        const dateA = a.endDate || a.startDate || 0;
                        const dateB = b.endDate || b.startDate || 0;
                        return dateA - dateB;
                      })
                      .slice(0, 10)
                      .map(task => {
                        const project = projects?.find(p => p._id === task.projectId);
                        return (
                          <div key={task._id} className="flex items-center justify-between border-l-2 border-red-500 pl-3 py-2">
                            <div className="flex-1">
                              <p className="font-medium">{task.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {project?.name} • Due {new Date((task.endDate || task.startDate)!).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant={task.priority === "urgent" ? "destructive" : "secondary"}>
                              {task.priority || "medium"}
                            </Badge>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Completed Tasks */}
            <Card>
              <CardHeader>
                <CardTitle>Recently Completed</CardTitle>
                <CardDescription>Last 5 completed tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teamTasks && teamTasks.filter(t => t.status === "done").length > 0 ? (
                    teamTasks
                      .filter(task => task.status === "done")
                      .sort((a, b) => (b.updatedAt || b._creationTime) - (a.updatedAt || a._creationTime))
                      .slice(0, 5)
                      .map(task => {
                        const project = projects?.find(p => p._id === task.projectId);
                        return (
                          <div key={task._id} className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{task.title}</p>
                              <p className="text-xs text-muted-foreground">{project?.name}</p>
                            </div>
                            <Badge variant="default">Done</Badge>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No completed tasks yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="mt-6">
          <div className="space-y-6">
            {/* Financial Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalBudget.toLocaleString()} $</div>
                  <p className="text-xs text-muted-foreground">
                    Across {totalProjects} projects
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Shopping List</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalShoppingCost.toLocaleString()} $</div>
                  <p className="text-xs text-muted-foreground">
                    {shoppingItems?.length || 0} items planned
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ordered Items</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{orderedShoppingCost.toLocaleString()} $</div>
                  <p className="text-xs text-muted-foreground">
                    Already ordered/delivered
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Task Costs</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalTaskCost.toLocaleString()} $</div>
                  <p className="text-xs text-muted-foreground">
                    Total task costs tracked
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Shopping List Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Shopping List by Status</CardTitle>
                <CardDescription>Items breakdown by realization status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {shoppingItems && shoppingItems.length > 0 ? (
                    ["PLANNED", "ORDERED", "IN_TRANSIT", "DELIVERED", "COMPLETED", "CANCELLED"].map(status => {
                      const items = shoppingItems.filter(item => item.realizationStatus === status);
                      const cost = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
                      if (items.length === 0) return null;

                      return (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              status === "COMPLETED" ? "default" :
                              status === "DELIVERED" ? "secondary" :
                              status === "CANCELLED" ? "outline" :
                              "secondary"
                            }>
                              {status}
                            </Badge>
                            <span className="text-sm">{items.length} items</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{cost.toLocaleString()} $</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No shopping list items yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Budget by Project */}
            <Card>
              <CardHeader>
                <CardTitle>Budget Overview</CardTitle>
                <CardDescription>Project budgets comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projects && projects.length > 0 ? (
                    projects
                      .filter(p => p.budget && p.budget > 0)
                      .sort((a, b) => (b.budget || 0) - (a.budget || 0))
                      .slice(0, 5)
                      .map(project => (
                        <div key={project._id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{project.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {project.currency || 'USD'} • {project.status}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{(project.budget || 0).toLocaleString()} $</p>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No budget data available yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
