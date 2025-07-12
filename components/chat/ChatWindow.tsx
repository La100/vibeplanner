"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";

import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ChannelMembersModal } from "./ChannelMembersModal";
import { Button } from "@/components/ui/button";
import { Menu, Hash, Lock, Settings} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelSidebar } from "./ChannelSidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// NOTE: This should ideally be in a shared types file
interface Channel {
  _id: Id<"chatChannels">;
  name: string;
  description?: string | null;
  isPrivate: boolean;
  isDefault: boolean;
  type: "team" | "project";
}

interface ChatWindowProps {
  channelId: Id<"chatChannels">;
  
  // Props for mobile overlay sidebar
  isMobile?: boolean;
  channels?: Channel[];
  selectedChannelId?: Id<"chatChannels"> | null;
  onChannelSelect?: (channelId: Id<"chatChannels">) => void;
  type?: "team" | "project";
  teamId?: Id<"teams">;
  projectId?: Id<"projects">;
  onChannelDeleted?: () => void;
}

export function ChatWindow({ 
  channelId,
  isMobile,
  channels,
  selectedChannelId,
  onChannelSelect,
  type,
  teamId,
  projectId,
  onChannelDeleted,
}: ChatWindowProps) {
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isChannelListVisible, setIsChannelListVisible] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  
  const channel = useQuery(api.chatChannels.getChannel, { channelId });
  const updateChannel = useMutation(api.chatChannels.updateChannel);
  const deleteChannel = useMutation(api.chatChannels.deleteChannel);

  const messagesData = useQuery(api.chatMessages.listChannelMessages, { 
    channelId, 
    paginationOpts: { numItems: 50, cursor: null }
  });
  
  const messages = messagesData ? messagesData.page : undefined;

  const markChannelAsRead = useMutation(api.chatMessages.markChannelAsRead);

  // Automatically mark channel as read when user opens it
  useEffect(() => {
    if (channel) {
      markChannelAsRead({ channelId }).catch(console.error);
    }
  }, [channelId, channel, markChannelAsRead]);

  useEffect(() => {
    if (channel) {
      setNewChannelName(channel.name);
    }
  }, [channel]);

  const handleRenameChannel = async () => {
    if (!newChannelName.trim() || newChannelName.trim() === channel?.name) {
      setIsRenameModalOpen(false);
      return;
    }
    try {
      await updateChannel({ channelId: channel!._id, name: newChannelName.trim() });
      toast.success("Channel renamed");
      setIsRenameModalOpen(false);
    } catch (error) {
      toast.error("Failed to rename channel");
      console.error(error);
    }
  };

  const handleDeleteChannel = async () => {
    try {
      await deleteChannel({ channelId: channel!._id });
      toast.success("Channel deleted");
      if (onChannelDeleted) {
        onChannelDeleted();
      }
    } catch (error) {
      toast.error("Failed to delete channel");
      console.error(error);
    }
  };

  if (channel === undefined || messages === undefined) {
    return <ChatWindowSkeleton />;
  }
  
  if (!channel) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Channel not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Channel Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          {isMobile && (
             <Button 
              variant="ghost" 
              size="icon" 
              className="-ml-2" 
              onClick={() => setIsChannelListVisible(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          {channel.isPrivate ? (
            <Lock className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Hash className="h-5 w-5 text-muted-foreground" />
          )}
          
          <div>
            <h1 className="font-semibold text-lg">{channel.name}</h1>
            {channel.description && (
              <p className="text-sm text-muted-foreground">{channel.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setIsRenameModalOpen(true)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDeleteChannel} className="text-red-500">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Mobile Channel Sidebar Overlay */}
      {isMobile && isChannelListVisible && (
        <div className="absolute inset-0 z-20 bg-background">
          <ChannelSidebar
            channels={channels || []}
            selectedChannelId={selectedChannelId || null}
            onChannelSelect={(id) => {
              if (onChannelSelect) onChannelSelect(id);
              setIsChannelListVisible(false);
            }}
            type={type!}
            teamId={teamId}
            projectId={projectId}
            onClose={() => setIsChannelListVisible(false)}
          />
        </div>
      )}


      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <MessageList 
          channelId={channelId}
          messages={messages as Doc<"chatMessages">[]}
        />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t">
        <MessageInput 
          channelId={channelId}
          placeholder={`Message #${channel.name}`}
        />
      </div>

      <Dialog open={isRenameModalOpen} onOpenChange={setIsRenameModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Channel</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="channelName">Channel Name</Label>
            <Input
              id="channelName"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" onClick={handleRenameChannel}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Members Modal */}
      <ChannelMembersModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        channelId={channelId}
      />
    </div>
  );
}


function ChatWindowSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 p-4 space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <div className="flex-1 space-y-2 max-w-sm">
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </div>
      {/* Input */}
      <div className="p-4 border-t">
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
} 