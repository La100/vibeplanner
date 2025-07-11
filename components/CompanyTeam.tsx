"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";

import { Users, Mail, Search,  Crown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { InviteMemberDialog } from "./InviteMemberDialog";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { OrganizationProfile } from "@clerk/nextjs";

type TeamMemberRole = "admin" | "member" | "client";

// Define TeamMember type based on the structure returned by getTeamMembers
type TeamMember = {
  _id: Id<"teamMembers">;
  _creationTime: number;
  teamId: Id<"teams">;
  clerkUserId: string;
  clerkOrgId: string;
  role: string;
  permissions: string[];
  name: string;
  email: string;
  imageUrl?: string;
  joinedAt?: number;
  projectIds?: Id<"projects">[];
  isActive: boolean;
};

// Define PendingInvitation type based on actual structure
type PendingInvitation = {
  _id: Id<"invitations">;
  _creationTime: number;
  email: string;
  role: string;
  teamId: Id<"teams">;
  status: string;
  invitedBy: string;
  clerkInvitationId: string;
};

export default function CompanyTeam() {
  const params = useParams<{ slug: string }>();
  const { organization, isLoaded } = useOrganization();

  const team = useQuery(api.teams.getTeamBySlug, params.slug ? { slug: params.slug } : "skip");
  const teamMembers = useQuery(api.teams.getTeamMembers, team ? { teamId: team._id } : "skip");
  const currentUserMember = useQuery(api.teams.getCurrentUserTeamMember, team ? { teamId: team._id } : "skip");
  const pendingInvitations = useQuery(api.teams.getPendingInvitations, team ? { teamId: team._id } : "skip");

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const changeTeamMemberRole = useMutation(api.teams.changeTeamMemberRole);
  const revokeInvitation = useMutation(api.teams.revokeInvitation);

  const handleRoleChange = async (clerkUserId: string, teamId: Id<"teams">, role: "admin" | "member" | "client") => {
    try {
      await changeTeamMemberRole({ clerkUserId, teamId, role });
      toast.success("Role updated successfully");
    } catch (error) {
      toast.error("Failed to update role", {
        description: (error as Error).message,
      });
    }
  };

  const handleRevoke = async (invitationId: Id<"invitations">) => {
    try {
      await revokeInvitation({ invitationId });
      toast.success("Invitation revoked");
    } catch (error) {
      toast.error("Failed to revoke invitation", {
        description: (error as Error).message,
      });
    }
  };

  if (!isLoaded || !organization || !team || !teamMembers || !currentUserMember || !pendingInvitations) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const filteredMembers = teamMembers.filter((member: TeamMember) => {
    const nameMatch = member.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const emailMatch = member.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const roleMatch = roleFilter === 'all' || member.role === roleFilter;
    return (nameMatch || emailMatch) && roleMatch;
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex flex-col gap-4 p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Team Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage your organization members and permissions
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <InviteMemberDialog teamId={team._id}>
              <Button>
                <Mail className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </InviteMemberDialog>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <Tabs defaultValue="members" className="w-full">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invitations">Pending Invitations</TabsTrigger>
            <TabsTrigger value="settings">Team Settings</TabsTrigger>
            <TabsTrigger value="clerk">Clerk Management (Temp)</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-6">
            <div className="space-y-6">
              {/* Team Stats */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{organization.membersCount || 0}</div>
                    <p className="text-xs text-muted-foreground">Active team members</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Administrators</CardTitle>
                    <Crown className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">1</div>
                    <p className="text-xs text-muted-foreground">Admin users</p>
                  </CardContent>
                </Card>
              </div>

              {/* Members List */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Team Members</h3>
                
                <Card>
                  <CardContent className="p-0">
                    <div className="space-y-4">
                      {filteredMembers.map((member: TeamMember) => (
                        <div key={member.clerkUserId} className="flex items-center justify-between p-4 border-b last:border-b-0">
                          <div className="flex items-center gap-4">
                            <Avatar>
                              {member.imageUrl && <AvatarImage src={member.imageUrl} />}
                              <AvatarFallback>{member.name ? member.name[0].toUpperCase() : 'U'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold">{member.name}</p>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                          <Select 
                            value={member.role} 
                            onValueChange={(newRole) => handleRoleChange(member.clerkUserId, member.teamId, newRole as TeamMemberRole)}
                            disabled={member.clerkUserId === currentUserMember?.clerkUserId || currentUserMember?.role !== 'admin'}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="client">Client</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="invitations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>
                  Manage pending team invitations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingInvitations.length > 0 ? (
                  <div className="space-y-4">
                    {pendingInvitations.map((inv: PendingInvitation) => (
                      <div key={inv._id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{inv.email}</p>
                          <p className="text-sm text-muted-foreground">Role: {inv.role}</p>
                        </div>
                        {currentUserMember?.role === 'admin' && (
                           <Button variant="ghost" size="icon" onClick={() => handleRevoke(inv._id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Mail className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No pending invitations</h3>
                      <p className="text-muted-foreground mb-4">
                        All team invitations have been accepted.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Team Settings</CardTitle>
                  <CardDescription>
                    Configure team-wide settings and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Team Name</h4>
                        <p className="text-sm text-muted-foreground">
                          {organization.name}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">Edit</Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Default Project Permissions</h4>
                        <p className="text-sm text-muted-foreground">
                          Set default permissions for new team members
                        </p>
                      </div>
                      <Button variant="outline" size="sm">Configure</Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Team Slug</h4>
                        <p className="text-sm text-muted-foreground">
                          /{params.slug}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">Change</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="clerk" className="mt-6">
            <OrganizationProfile />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
