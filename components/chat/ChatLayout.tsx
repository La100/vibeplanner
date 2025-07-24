"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MessageSquare } from "lucide-react";

import { ChannelSidebar } from "./ChannelSidebar";
import { ChatWindow } from "./ChatWindow";
import { Card } from "@/components/ui/card";

const CHAT_SIDEBAR_BREAKPOINT = 1024; // lg

interface ChatLayoutProps {
  teamId?: Id<"teams">;
  projectId?: Id<"projects">;
  type: "team" | "project";
}

export function ChatLayout({ teamId, projectId, type }: ChatLayoutProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<Id<"chatChannels"> | null>(null);
  const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(max-width: ${CHAT_SIDEBAR_BREAKPOINT - 1}px)`
    );
    
    const handleResize = () => {
      setIsChatSidebarCollapsed(mediaQuery.matches);
    };

    mediaQuery.addEventListener("change", handleResize);
    handleResize(); 

    return () => mediaQuery.removeEventListener("change", handleResize);
  }, []);

  // Load channels based on type
  const teamChannels = useQuery(
    api.chatChannels.listTeamChannels,
    type === "team" && teamId ? { teamId } : "skip"
  );

  const projectChannels = useQuery(
    api.chatChannels.listProjectChannels,
    type === "project" && projectId ? { projectId } : "skip"
  );

  const channels = type === "team" ? teamChannels : projectChannels;

  // Auto-select first channel if none selected
  if (channels && channels.length > 0 && !selectedChannelId) {
    const defaultChannel = channels.find(ch => ch.isDefault) || channels[0];
    if (defaultChannel) {
      setSelectedChannelId(defaultChannel._id);
    }
  }

  const handleChannelDeleted = () => {
    if (channels && channels.length > 1) {
      const remainingChannels = channels.filter(c => c._id !== selectedChannelId);
      const defaultChannel = remainingChannels.find(ch => ch.isDefault) || remainingChannels[0];
      setSelectedChannelId(defaultChannel._id);
    } else {
      setSelectedChannelId(null);
    }
  }

  // Unified Empty State - show create channel UI if no channels exist
  if (channels && channels.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <Card className="p-6 md:p-8 text-center max-w-md w-full">
           <div className="flex items-center justify-center mb-4">
             <div className="p-3 bg-primary/10 rounded-full">
               <MessageSquare className="h-8 w-8 text-primary" />
             </div>
           </div>
           <h3 className="text-xl font-semibold mb-2">
             Welcome to {type} chat!
           </h3>
           <p className="text-muted-foreground mb-6 text-sm">
             Get started by creating your first channel.
           </p>
           {/* This just shows the header with the create (+) button */}
           <ChannelSidebar
             channels={[]}
             selectedChannelId={null}
             onChannelSelect={() => {}}
             type={type}
             teamId={teamId}
             projectId={projectId}
           />
         </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Desktop Sidebar */}
      {!isChatSidebarCollapsed && (
        <div className="w-64 border-r">
          <ChannelSidebar
            channels={channels || []}
            selectedChannelId={selectedChannelId}
            onChannelSelect={setSelectedChannelId}
            type={type}
            teamId={teamId}
            projectId={projectId}
          />
        </div>
      )}

      {/* Main Chat Window */}
      <div className="flex-1">
        {selectedChannelId ? (
          <ChatWindow
            channelId={selectedChannelId}
            // Pass props for mobile overlay
            isMobile={isChatSidebarCollapsed}
            channels={channels}
            selectedChannelId={selectedChannelId}
            onChannelSelect={setSelectedChannelId}
            type={type}
            teamId={teamId}
            projectId={projectId}
            onChannelDeleted={handleChannelDeleted}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Card className="p-8 text-center max-w-md">
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Select a channel
              </h3>
              <p className="text-sm text-muted-foreground">
                Your conversation will appear here.
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
} 