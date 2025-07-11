"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { ChatLayout } from "@/components/chat/ChatLayout";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Users } from "lucide-react";

export default function TeamChatPage() {
  const params = useParams<{ slug: string }>();
  
  const team = useQuery(api.teams.getTeamBySlug, 
    params.slug ? { slug: params.slug } : "skip"
  );

  if (team === undefined) {
    return (
      <div className="h-full p-6">
        <div className="h-full">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-8 w-8 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          
          <Card className="h-[calc(100vh-200px)]">
            <div className="flex h-full">
              <div className="w-80 border-r">
                <div className="p-4 border-b">
                  <Skeleton className="h-6 w-32" />
                </div>
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <Skeleton className="h-20 w-64" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">
            Team Not Found
          </h3>
          <p className="text-sm text-muted-foreground">
            The team you're looking for doesn't exist or you don't have access to it.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full p-6">
      <div className="h-full">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Team Chat</h1>
            <p className="text-muted-foreground">
              Communicate with your team members in real-time
            </p>
          </div>
        </div>

        {/* Chat Interface */}
        <Card className="h-[calc(100vh-200px)]">
          <ChatLayout
            teamId={team._id}
            type="team"
          />
        </Card>
      </div>
    </div>
  );
} 