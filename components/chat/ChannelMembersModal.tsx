"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserPlus, X, Crown, User, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface ChannelMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: Id<"chatChannels">;
}

export function ChannelMembersModal({
  isOpen,
  onClose,
  channelId,
}: ChannelMembersModalProps) {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  // Queries
  const members = useQuery(api.chatChannels.listChannelMembers, { channelId });
  const availableUsers = useQuery(api.chatChannels.getAvailableUsersForChannel, { channelId });

  // Mutations
  const addUser = useMutation(api.chatChannels.addUserToChannel);
  const removeUser = useMutation(api.chatChannels.removeUserFromChannel);
  const updateRole = useMutation(api.chatChannels.updateChannelMemberRole);

  const handleAddUser = async (userId: string) => {
    try {
      await addUser({
        channelId,
        userId,
        role: "member",
      });
      setIsAddUserOpen(false);
      toast.success("User added to channel");
    } catch (error) {
      toast.error("Failed to add user to channel");
      console.error(error);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      await removeUser({ channelId, userId });
      toast.success("User removed from channel");
    } catch (error) {
      toast.error("Failed to remove user from channel");
      console.error(error);
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "member" : "admin";
    try {
      await updateRole({ channelId, userId, role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      toast.error("Failed to update user role");
      console.error(error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

 

  const getRoleIcon = (role: string) => {
    return role === "admin" ? Crown : User;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Channel Members</DialogTitle>
        </DialogHeader>

        <div className="absolute top-4 right-14">
          <Popover open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add User
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <Command>
                <CommandInput placeholder="Search users..." />
                <CommandList>
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup>
                    {availableUsers?.map((user) => (
                      <CommandItem
                        key={user.clerkUserId}
                        onSelect={() => handleAddUser(user.clerkUserId)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={user.imageUrl} />
                            <AvatarFallback className="text-xs">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {user.teamRole}
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <ScrollArea className="max-h-96 pt-4">
          <div className="space-y-2">
            {members === undefined ? (
              <div className="text-center py-4 text-muted-foreground">
                Loading members...
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No members in this channel
              </div>
            ) : (
              members.map((member) => {
                const RoleIcon = getRoleIcon(member.role);
                return (
                  <div
                    key={member._id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.userImageUrl} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {member.userName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.userEmail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs"
                          >
                            <RoleIcon className="h-3 w-3" />
                            {member.role}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-32 p-1" align="end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start gap-2 text-xs"
                            onClick={() =>
                              handleToggleRole(member.userId, member.role)
                            }
                          >
                            {member.role === "admin" ? (
                              <>
                                <User className="h-3 w-3" />
                                Make Member
                              </>
                            ) : (
                              <>
                                <Crown className="h-3 w-3" />
                                Make Admin
                              </>
                            )}
                          </Button>
                        </PopoverContent>
                      </Popover>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveUser(member.userId)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
} 