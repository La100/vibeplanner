"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface AddFromOrganizationFormProps {
  projectId: Id<"projects">;
}

interface OrganizationMember {
  clerkUserId: string;
  name: string;
  email: string;
  imageUrl?: string;
  role: string;
}

export function AddFromOrganizationForm({ projectId }: AddFromOrganizationFormProps) {
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  
  const availableMembers = useQuery(api.teams.getAvailableOrgMembersForProject, {
    projectId: projectId,
  });
  const debugInfo = useQuery(api.teams.debugTeamMembers, { projectId });
  const addMemberToProject = useMutation(api.teams.addExistingMemberToProject);

  // DEBUG: Log debug info to console
  console.log("=== DEBUG INFO ===");
  console.log("Available members:", availableMembers);
  console.log("All team members in DB:", debugInfo);

  const handleAddMember = async (clerkUserId: string, userName: string) => {
    setAddingUserId(clerkUserId);
    
    try {
      const result = await addMemberToProject({
        clerkUserId,
        projectId,
      });

      if (result.success) {
        toast.success("Member Added to Project", {
          description: `${userName} has been given access to this project.`,
        });
      }
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error("Error Adding Member", {
        description: (error as Error).message || "Failed to add member to project.",
      });
    } finally {
      setAddingUserId(null);
    }
  };

  if (!availableMembers) {
    return <div>Loading organization members...</div>;
  }

  if (availableMembers.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
          <Users className="h-4 w-4 lg:h-5 lg:w-5" />
          Add as Project Client
        </CardTitle>
        <CardDescription className="text-sm">
          Add organization members as dedicated project clients. They'll get focused notifications and project-specific access.
        </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6">
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No additional members to add as project clients.</p>
            <p className="text-xs mt-1 opacity-75">Admins and members already have full access. Viewers and clients can be added as dedicated project clients.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
          <Users className="h-4 w-4 lg:h-5 lg:w-5" />
          Add as Project Client
        </CardTitle>
        <CardDescription className="text-sm">
          Add organization members as dedicated project clients. They'll get focused notifications and project-specific access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 lg:px-6">
        {availableMembers.map((member: OrganizationMember) => (
          <div 
            key={member.clerkUserId} 
            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
              <Avatar className="h-8 w-8 lg:h-10 lg:w-10 flex-shrink-0">
                <AvatarImage src={member.imageUrl} alt={member.name} />
                <AvatarFallback className="text-xs">
                  {member.name ? member.name[0].toUpperCase() : member.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.name}</p>
                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="outline" className="text-xs">
                {member.role === "client" ? "Client" : member.role}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddMember(member.clerkUserId, member.name)}
                disabled={addingUserId === member.clerkUserId}
                className="text-xs h-8"
              >
                {addingUserId === member.clerkUserId ? (
                  <>Adding...</>
                ) : (
                  <>
                    <UserPlus className="h-3 w-3 mr-1" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
} 