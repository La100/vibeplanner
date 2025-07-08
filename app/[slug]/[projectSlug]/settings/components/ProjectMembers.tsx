"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Mail, UserX, Crown, User } from "lucide-react";
import { toast } from "sonner";
import { InviteClientForm } from "@/components/InviteClientForm";
import { AddFromOrganizationForm } from "@/components/AddFromOrganizationForm";
import { Id } from "@/convex/_generated/dataModel";

interface ProjectMembersProps {
  project: {
    _id: Id<"projects">;
    teamId: Id<"teams">;
    name: string;
  };
}

interface TeamMember {
  _id: Id<"teamMembers">;
  role: "admin" | "member" | "viewer" | "client";
  name: string;
  email: string;
  imageUrl?: string;
  clerkUserId: string;
}

export default function ProjectMembers({ project }: ProjectMembersProps) {
  // Get all team members
  const teamMembers = useQuery(api.teams.getTeamMembers, {
    teamId: project.teamId,
  });
  
  // Get current user's role
  const currentUserMember = useQuery(api.teams.getCurrentUserTeamMember, {
    teamId: project.teamId,
  });

  const isCurrentUserAdmin = currentUserMember?.role === "admin";

  if (!teamMembers || !currentUserMember) {
    return <div>Loading members...</div>;
  }

  // Filter team members by role
  const admins = teamMembers.filter((member: TeamMember) => member.role === "admin");
  const members = teamMembers.filter((member: TeamMember) => member.role === "member");
  const viewers = teamMembers.filter((member: TeamMember) => member.role === "viewer");
  const clients = teamMembers.filter((member: TeamMember) => member.role === "client");

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Team Members Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
            <Users className="h-4 w-4 lg:h-5 lg:w-5" />
            Team Members
          </CardTitle>
          <CardDescription className="text-sm">
            All team members have access to this project based on their team role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 lg:px-6">
          {/* Admins */}
          {admins.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                <h4 className="text-sm font-semibold">Administrators</h4>
                <Badge variant="default">{admins.length}</Badge>
              </div>
              <div className="space-y-2">
                {admins.map((member: TeamMember) => (
                  <MemberRow 
                    key={member._id} 
                    member={member} 
                    role="Admin"
                    description="Full project access"
                    canManage={false}
                    projectId={project._id}
                    teamId={project.teamId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Members */}
          {members.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pt-4 border-t">
                <User className="h-4 w-4 text-blue-500" />
                <h4 className="text-sm font-semibold">Members</h4>
                <Badge variant="secondary">{members.length}</Badge>
              </div>
              <div className="space-y-2">
                {members.map((member: TeamMember) => (
                  <MemberRow 
                    key={member._id} 
                    member={member} 
                    role="Member"
                    description="Can edit tasks and files"
                    canManage={isCurrentUserAdmin}
                    projectId={project._id}
                    teamId={project.teamId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Viewers */}
          {viewers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pt-4 border-t">
                <Users className="h-4 w-4 text-gray-500" />
                <h4 className="text-sm font-semibold">Viewers</h4>
                <Badge variant="outline">{viewers.length}</Badge>
              </div>
              <div className="space-y-2">
                {viewers.map((member: TeamMember) => (
                  <MemberRow 
                    key={member._id} 
                    member={member} 
                    role="Viewer"
                    description="Read-only access"
                    canManage={isCurrentUserAdmin}
                    projectId={project._id}
                    teamId={project.teamId}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Clients Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
            <Mail className="h-4 w-4 lg:h-5 lg:w-5" />
            Project Clients
          </CardTitle>
          <CardDescription className="text-sm">
            Clients invited specifically to this project. They only have access to this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 lg:px-6">
          {clients && clients.length > 0 ? (
            <div className="space-y-2">
              {clients.map((client: TeamMember) => (
                <ClientRow
                  key={client._id}
                  client={client}
                  canManage={isCurrentUserAdmin}
                  projectId={project._id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No clients invited to this project yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add from Organization Section */}
      <AddFromOrganizationForm projectId={project._id} />

      {/* Invite Client Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg lg:text-xl">Invite New Client</CardTitle>
          <CardDescription className="text-sm">
            Invite a new client by email. They will be added to the organization and given access to this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6">
          <InviteClientForm projectId={project._id} />
        </CardContent>
      </Card>
    </div>
  );
}

// Member Row Component
function MemberRow({ 
  member, 
  role, 
  description,
  canManage,
  projectId,
  teamId
}: { 
  member: TeamMember; 
  role: string; 
  description: string;
  canManage: boolean;
  projectId: Id<"projects">;
  teamId: Id<"teams">;
}) {
  const removeTeamMember = useMutation(api.teams.removeTeamMember);
  const changeTeamMemberRole = useMutation(api.teams.changeTeamMemberRole);

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin': return 'default';
      case 'member': return 'secondary';
      case 'viewer': return 'outline';
      default: return 'secondary';
    }
  };

  const handleRemoveMember = async () => {
    try {
      await removeTeamMember({
        clerkUserId: member.clerkUserId,
        teamId: teamId,
      });
      toast.success("Team member removed");
    } catch (error) {
      toast.error("Failed to remove team member: " + (error as Error).message);
    }
  };

  const handleChangeToClient = async () => {
    try {
      await changeTeamMemberRole({
        clerkUserId: member.clerkUserId,
        teamId: teamId,
        newRole: "client",
        projectId: projectId,
      });
      toast.success("Member changed to project client");
    } catch (error) {
      toast.error("Failed to change role: " + (error as Error).message);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
        <Avatar className="h-6 w-6 lg:h-8 lg:w-8 flex-shrink-0">
          <AvatarImage src={member.imageUrl} />
          <AvatarFallback className="text-xs">
            {member.name ? member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{member.name || 'Unknown'}</p>
          <p className="text-xs text-muted-foreground hidden sm:block">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge variant={getRoleColor(role) as "default" | "secondary" | "outline"} className="text-xs">{role}</Badge>
        {canManage && member.role === "member" && (
          <>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleChangeToClient}
              className="text-blue-600 hover:text-blue-700 h-6 w-6 lg:h-8 lg:w-8 p-0"
              title="Change to Project Client"
            >
              <Mail className="h-3 w-3 lg:h-4 lg:w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleRemoveMember}
              className="text-red-600 hover:text-red-700 h-6 w-6 lg:h-8 lg:w-8 p-0"
              title="Remove from team"
            >
              <UserX className="h-3 w-3 lg:h-4 lg:w-4" />
            </Button>
          </>
        )}
        {canManage && member.role === "viewer" && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleRemoveMember}
            className="text-red-600 hover:text-red-700 h-6 w-6 lg:h-8 lg:w-8 p-0"
            title="Remove from team"
          >
            <UserX className="h-3 w-3 lg:h-4 lg:w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Client Row Component
function ClientRow({ 
  client, 
  canManage,
  projectId
}: { 
  client: TeamMember; 
  canManage: boolean;
  projectId: Id<"projects">;
}) {
  const removeProjectFromClient = useMutation(api.teams.removeProjectFromClient);

  const handleRemoveClient = async () => {
    try {
      await removeProjectFromClient({
        clerkUserId: client.clerkUserId,
        projectId: projectId,
      });
      toast.success("Client access removed");
    } catch {
      toast.error("Failed to remove client access");
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
        <Avatar className="h-6 w-6 lg:h-8 lg:w-8 flex-shrink-0">
          <AvatarFallback className="text-xs">
            {client.email ? client.email[0].toUpperCase() : 'C'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{client.email}</p>
          <p className="text-xs text-muted-foreground hidden sm:block">Project client</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge variant="default" className="text-xs">Client</Badge>
        {canManage && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleRemoveClient}
            className="text-red-600 hover:text-red-700 h-6 w-6 lg:h-8 lg:w-8 p-0"
          >
            <UserX className="h-3 w-3 lg:h-4 lg:w-4" />
          </Button>
        )}
      </div>
    </div>
  );
} 