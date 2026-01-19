"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

import { 
  Users, Building2, FolderOpen, Search, CheckCircle2, 
  Clock, AlertCircle, Link as LinkIcon
} from "lucide-react";

interface CustomerProjectMatrixProps {
  teamId: Id<"teams">;
}


type CustomerWithProjects = {
  email: string;
  name?: string;
  imageUrl?: string;
  clerkUserId?: string;
  overallStatus: "active" | "invited" | "mixed";
  projects: Array<{
    projectId: Id<"projects">;
    projectName: string;
    projectSlug: string;
    status: "invited" | "active" | "inactive";
    customerId: Id<"customers">;
  }>;
};

export default function CustomerProjectMatrix({ teamId }: CustomerProjectMatrixProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Get all customers for this team
  const allCustomers = useQuery(apiAny.customers.listTeamCustomers, { teamId });
  
  // Get all projects for this team
  const teamProjects = useQuery(apiAny.projects.listProjectsByTeam, { teamId });

  // Get team info for navigation
  const team = useQuery(apiAny.teams.getTeam, { teamId });

  if (!allCustomers || !teamProjects || !team) {
    return <div>Loading customer overview...</div>;
  }

  // Group customers by email and aggregate their projects
  const customerMap = new Map<string, CustomerWithProjects>();

  allCustomers.forEach((customer) => {
    const project = teamProjects.find(p => p._id === customer.projectId);
    if (!project) return;

    if (!customerMap.has(customer.email)) {
      customerMap.set(customer.email, {
        email: customer.email,
        name: 'name' in customer ? customer.name : undefined,
        imageUrl: 'imageUrl' in customer ? customer.imageUrl : undefined,
        clerkUserId: customer.clerkUserId,
        overallStatus: customer.status === "inactive" ? "invited" : customer.status,
        projects: []
      });
    }

    const customerData = customerMap.get(customer.email)!;
    customerData.projects.push({
      projectId: project._id,
      projectName: project.name,
      projectSlug: project.slug,
      status: customer.status,
      customerId: customer._id
    });

    // Update overall status
    const statuses = customerData.projects.map(p => p.status);
    if (statuses.every(s => s === "active")) {
      customerData.overallStatus = "active";
    } else if (statuses.every(s => s === "invited")) {
      customerData.overallStatus = "invited";
    } else {
      customerData.overallStatus = "mixed";
    }
  });

  const customersWithProjects = Array.from(customerMap.values());

  // Filter customers
  const filteredCustomers = customersWithProjects.filter(customer => {
    const nameMatch = customer.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const emailMatch = customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    const projectMatch = customer.projects.some(p => 
      p.projectName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return nameMatch || emailMatch || projectMatch;
  });

  // Statistics
  const totalCustomers = customersWithProjects.length;
  const activeCustomers = customersWithProjects.filter(c => 
    c.overallStatus === "active" || c.projects.some(p => p.status === "active")
  ).length;
  const pendingCustomers = customersWithProjects.filter(c => 
    c.projects.some(p => p.status === "invited")
  ).length;
  const totalProjectAssignments = allCustomers.length;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Unique customer accounts</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCustomers}</div>
            <p className="text-xs text-muted-foreground">Currently accessing projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCustomers}</div>
            <p className="text-xs text-muted-foreground">Awaiting responses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Project Access</CardTitle>
            <FolderOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjectAssignments}</div>
            <p className="text-xs text-muted-foreground">Total project assignments</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers or projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Customer Project Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Customer Project Access Overview
          </CardTitle>
          <CardDescription>
            View and track which customers have access to which projects. 
            Manage individual project access from each project's settings page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length > 0 ? (
            <div className="space-y-4">
              {filteredCustomers.map((customer) => (
                <div key={customer.email} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        {customer.imageUrl && <AvatarImage src={customer.imageUrl} />}
                        <AvatarFallback>
                          {customer.name?.[0]?.toUpperCase() || customer.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{customer.name || customer.email}</p>
                        {customer.name && (
                          <p className="text-sm text-muted-foreground">{customer.email}</p>
                        )}
                      </div>
                    </div>
                    <Badge 
                      variant={
                        customer.overallStatus === "active" ? "default" : 
                        customer.overallStatus === "invited" ? "secondary" : "outline"
                      }
                      className="text-xs"
                    >
                      {customer.overallStatus === "mixed" ? "Mixed Status" : customer.overallStatus}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Project Access ({customer.projects.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {customer.projects.map((project) => (
                        <div key={project.projectId} className="flex items-center gap-2">
                          <Badge
                            variant={
                              project.status === "active" ? "default" : 
                              project.status === "invited" ? "secondary" : "outline"
                            }
                            className="text-xs"
                          >
                            {project.projectName}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              // Navigate to project settings
                              window.open(`/organisation/projects/${project.projectSlug}/settings`, '_blank');
                            }}
                            title="Open project settings"
                          >
                            <LinkIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : totalCustomers === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No customers yet</h3>
              <p className="text-muted-foreground mb-6">
                Customers will appear here once you invite them to projects.
              </p>
              <p className="text-sm text-muted-foreground">
                💡 Go to any project's settings page to invite customers.
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No customers found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search terms.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <FolderOpen className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">How to manage customers</h3>
              <p className="text-sm text-blue-700 mt-1">
                This page shows an overview of all customers across your organization. 
                To invite customers or manage their access, go to the specific project's settings page.
              </p>
              <p className="text-xs text-blue-600 mt-2">
                Each customer can have access to multiple projects, and you manage them individually per project.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
