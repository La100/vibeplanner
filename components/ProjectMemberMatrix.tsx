"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { 
  Users, UserPlus, UserMinus, Mail, Building2, FolderOpen, 
  Check, X, Plus, Search 
} from "lucide-react";
import { toast } from "sonner";

interface ProjectMemberMatrixProps {
  teamId: Id<"teams">;
}

type TeamMember = {
  _id: Id<"teamMembers">;
  clerkUserId: string;
  role: "admin" | "member" | "customer";
  name: string;
  email: string;
  imageUrl?: string;
};

type Project = {
  _id: Id<"projects">;
  name: string;
  customer?: string;
  status: string;
};

type Customer = {
  _id: Id<"customers">;
  email: string;
  clerkUserId?: string;
  projectId: Id<"projects">;
  status: "invited" | "active" | "inactive";
  name?: string;
  imageUrl?: string;
  teamId: Id<"teams">;
  invitedBy: string;
  invitedAt: number;
  joinedAt?: number;
};

export default function ProjectMemberMatrix({ teamId }: ProjectMemberMatrixProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "admin" | "member" | "customer">("all");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteProjectId, setInviteProjectId] = useState<string>("");

  // Queries
  const teamMembers = useQuery(api.teams.getTeamMembers, { teamId });
  const projects = useQuery(api.projects.listTeamProjects, { teamId });
  const customers = useQuery(api.customers.listTeamCustomers, { teamId });

  // Mutations
  const inviteCustomer = useMutation(api.customers.inviteCustomerToProject);
  const removeCustomerAccess = useMutation(api.customers.removeCustomerAccess);
  const toggleCustomerStatus = useMutation(api.customers.toggleCustomerStatus);

  if (!teamMembers || !projects || !customers) {
    return <div className="p-6">Loading...</div>;
  }

  // Filter and search logic
  const filteredMembers = teamMembers.filter((member: TeamMember) => {
    const matchesSearch = member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterRole === "all" || member.role === filterRole;
    return matchesSearch && matchesFilter;
  });

  const filteredCustomers = customers.filter((customer: Customer) => {
    const matchesSearch = customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterRole === "all" || filterRole === "customer";
    return matchesSearch && matchesFilter;
  });

  // Helper functions
  const getCustomerForProject = (projectId: Id<"projects">) => {
    return customers.find(c => c.projectId === projectId);
  };

  const getProjectName = (projectId: Id<"projects">) => {
    return projects.find(p => p._id === projectId)?.name || "Unknown Project";
  };

  const handleInviteCustomer = async () => {
    if (!inviteEmail || !inviteProjectId) return;
    
    try {
      await inviteCustomer({
        email: inviteEmail,
        projectId: inviteProjectId as Id<"projects">,
      });
      toast.success("Customer invited successfully");
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteProjectId("");
    } catch (error) {
      toast.error("Failed to invite customer");
      console.error(error);
    }
  };

  const handleRemoveAccess = async (customerId: Id<"customers">) => {
    try {
      await removeCustomerAccess({ customerId });
      toast.success("Customer access removed");
    } catch (error) {
      toast.error("Failed to remove access");
      console.error(error);
    }
  };

  const handleToggleStatus = async (customerId: Id<"customers">) => {
    try {
      await toggleCustomerStatus({ customerId });
      toast.success("Customer status updated");
    } catch (error) {
      toast.error("Failed to update status");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Project Access Management</h2>
          <p className="text-muted-foreground">Manage who has access to which projects</p>
        </div>
        
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Customer to Project</DialogTitle>
              <DialogDescription>
                Invite a customer to access a specific project
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Customer Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="customer@example.com"
                />
              </div>
              <div>
                <Label htmlFor="project">Project</Label>
                <Select value={inviteProjectId} onValueChange={setInviteProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project: Project) => (
                      <SelectItem key={project._id} value={project._id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleInviteCustomer}>
                Send Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members and customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterRole} onValueChange={(value) => setFilterRole(value as "all" | "admin" | "member" | "customer")}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Team Members Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
          <CardDescription>
            Internal team members have access to all projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredMembers.map((member: TeamMember) => (
              <div key={member.clerkUserId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.imageUrl} />
                    <AvatarFallback>
                      {member.name ? member.name[0].toUpperCase() : member.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                    {member.role}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <FolderOpen className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">All projects</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Project-Specific Customers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Project Customers
          </CardTitle>
          <CardDescription>
            Customers with access to specific projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projects.map((project: Project) => {
              const customer = getCustomerForProject(project._id);
              
              return (
                <div key={project._id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      <span className="font-medium">{project.name}</span>
                      <Badge variant="outline">{project.status}</Badge>
                    </div>
                  </div>
                  
                  {customer ? (
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                                                 <Avatar className="h-8 w-8">
                           <AvatarImage src={''} />
                           <AvatarFallback>
                             {((customer as Customer).name || customer.email)[0].toUpperCase()}
                           </AvatarFallback>
                         </Avatar>
                         <div>
                           <p className="font-medium">{(customer as Customer).name || customer.email}</p>
                           <p className="text-sm text-muted-foreground">{customer.email}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={customer.status === "active" ? "default" : 
                                  customer.status === "invited" ? "secondary" : "destructive"}
                        >
                          {customer.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(customer._id)}
                          title={customer.status === "active" ? "Deactivate" : "Activate"}
                        >
                          {customer.status === "active" ? (
                            <X className="h-4 w-4 text-orange-600" />
                          ) : (
                            <Check className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAccess(customer._id)}
                          title="Remove access"
                        >
                          <UserMinus className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                      <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No customer assigned to this project</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setInviteProjectId(project._id);
                          setShowInviteDialog(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Assign Customer
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Orphaned Customers (customers without valid projects) */}
      {filteredCustomers.filter(c => !projects.find(p => p._id === c.projectId)).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600">Orphaned Customers</CardTitle>
            <CardDescription>
              Customers with access to deleted or invalid projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredCustomers
                .filter(c => !projects.find(p => p._id === c.projectId))
                .map((customer: Customer) => (
                  <div key={customer._id} className="flex items-center justify-between p-3 border border-orange-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={customer.imageUrl} />
                        <AvatarFallback>
                          {customer.name ? customer.name[0].toUpperCase() : customer.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{customer.name || customer.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Project: {getProjectName(customer.projectId)} (deleted)
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveAccess(customer._id)}
                    >
                      <UserMinus className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 