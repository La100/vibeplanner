"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";

import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ChannelMembersModal } from "./ChannelMembersModal";
import { Button } from "@/components/ui/button";
import { Menu, Hash, Lock, Settings, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelSidebar } from "./ChannelSidebar";

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
}: ChatWindowProps) {
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isChannelListVisible, setIsChannelListVisible] = useState(false);
  
  const channel = useQuery(api.chatChannels.getChannel, { channelId });
  
  const messagesData = useQuery(api.chatMessages.listChannelMessages, { 
    channelId, 
    paginationOpts: { numItems: 50, cursor: null }
  });
  
  const messages = messagesData ? messagesData.page : undefined;

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
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsMembersModalOpen(true)}
          >
            <Users className="h-4 w-4" />
          </Button>
          
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
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