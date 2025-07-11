"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Plus, 
  Hash, 
  Lock, 
  MessageSquare,
  Users,
  X
} from "lucide-react";
import { toast } from "sonner";

interface Channel {
  _id: Id<"chatChannels">;
  name: string;
  description?: string | null;
  isPrivate: boolean;
  isDefault: boolean;
  type: "team" | "project";
}

interface ChannelSidebarProps {
  channels: Channel[];
  selectedChannelId: Id<"chatChannels"> | null;
  onChannelSelect: (channelId: Id<"chatChannels">) => void;
  type: "team" | "project";
  teamId?: Id<"teams">;
  projectId?: Id<"projects">;
  onClose?: () => void;
}

export function ChannelSidebar({
  channels,
  selectedChannelId,
  onChannelSelect,
  type,
  teamId,
  projectId,
  onClose,
}: ChannelSidebarProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createTeamChannel = useMutation(api.chatChannels.createTeamChannel);
  const createProjectChannel = useMutation(api.chatChannels.createProjectChannel);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error("Channel name is required");
      return;
    }

    setIsCreating(true);
    try {
      if (type === "team" && teamId) {
        await createTeamChannel({
          name: newChannelName.trim(),
          teamId,
          description: newChannelDescription.trim() || undefined,
          isPrivate: false,
        });
      } else if (type === "project" && projectId) {
        await createProjectChannel({
          name: newChannelName.trim(),
          projectId,
          description: newChannelDescription.trim() || undefined,
          isPrivate: false,
        });
      }

      toast.success("Channel created successfully");
      setIsCreateDialogOpen(false);
      setNewChannelName("");
      setNewChannelDescription("");
    } catch (error) {
      toast.error("Failed to create channel");
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {type === "team" ? (
              <Users className="h-5 w-5 text-muted-foreground" />
            ) : (
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            )}
            <h2 className="font-semibold">
              {type === "team" ? "Team Channels" : "Project Channels"}
            </h2>
          </div>
          
          <div className="flex items-center">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Create New {type === "team" ? "Team" : "Project"} Channel
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Channel Name</label>
                    <Input
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="e.g. general, announcements"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description (Optional)</label>
                    <Input
                      value={newChannelDescription}
                      onChange={(e) => setNewChannelDescription(e.target.value)}
                      placeholder="What's this channel for?"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateChannel}
                      disabled={isCreating || !newChannelName.trim()}
                    >
                      {isCreating ? "Creating..." : "Create Channel"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="ml-1">
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Channels List */}
      {channels.length > 0 && (
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {channels.map((channel) => (
              <button
                key={channel._id}
                onClick={() => onChannelSelect(channel._id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors hover:bg-accent hover:text-accent-foreground ${
                  selectedChannelId === channel._id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {channel.isPrivate ? (
                  <Lock className="h-4 w-4 text-muted-foreground/50" />
                ) : (
                  <Hash className="h-4 w-4 text-muted-foreground/50" />
                )}
                
                <span className="flex-1 truncate">{channel.name}</span>
                
                {channel.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
} 