"use client";

import { useEffect, useRef } from "react";
import { Id } from "@/convex/_generated/dataModel";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Edit, Reply } from "lucide-react";

interface Message {
  _id: Id<"chatMessages">;
  content: string;
  authorId: string;
  authorName?: string;
  authorImageUrl?: string;
  _creationTime: number;
  isEdited: boolean;
  editedAt?: number;
  replyToMessage?: {
    content: string;
    authorName: string;
  };
}

interface MessageListProps {
  channelId: Id<"chatChannels">;
  messages: Message[];
}

export function MessageList({  messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
             ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const getAuthorInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground max-w-sm">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="font-semibold text-lg mb-2">No messages yet</h3>
          <p className="text-sm">
            Be the first to send a message in this channel! Start a conversation below.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" ref={scrollRef}>
      <div className="p-4 space-y-4">
        {messages.map((message, index) => {
          const previousMessage = index > 0 ? messages[index - 1] : null;
          const isConsecutive = 
            previousMessage?.authorId === message.authorId &&
            (message._creationTime - previousMessage._creationTime) < 5 * 60 * 1000; // 5 minutes

          return (
            <div key={message._id} className="group">
              {!isConsecutive && (
                <div className="flex items-start gap-3 hover:bg-accent/50 rounded-lg p-2 -m-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={message.authorImageUrl} />
                    <AvatarFallback className="text-xs">
                      {getAuthorInitials(message.authorName || "Unknown")}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-sm">
                        {message.authorName || "Unknown User"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message._creationTime)}
                      </span>
                      {message.isEdited && (
                        <Badge variant="outline" className="text-xs h-4">
                          <Edit className="h-3 w-3 mr-1" />
                          edited
                        </Badge>
                      )}
                    </div>
                    
                    {/* Reply indicator */}
                    {message.replyToMessage && (
                      <div className="mb-2 pl-3 border-l-2 border-muted-foreground/20">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Reply className="h-3 w-3" />
                          <span>{message.replyToMessage.authorName}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {message.replyToMessage.content}
                        </p>
                      </div>
                    )}
                    
                    <div className="text-sm leading-relaxed break-words">
                      {message.content}
                    </div>
                  </div>
                  
                  {/* Message actions - shown on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Actions will be added here */}
                  </div>
                </div>
              )}
              
              {/* Consecutive message (compact view) */}
              {isConsecutive && (
                <div className="flex items-start gap-3 hover:bg-accent/50 rounded-lg p-2 -m-2 group">
                  <div className="w-8 h-8 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">
                      {formatTime(message._creationTime).split(' ')[1] || formatTime(message._creationTime)}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {/* Reply indicator */}
                    {message.replyToMessage && (
                      <div className="mb-2 pl-3 border-l-2 border-muted-foreground/20">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Reply className="h-3 w-3" />
                          <span>{message.replyToMessage.authorName}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {message.replyToMessage.content}
                        </p>
                      </div>
                    )}
                    
                    <div className="text-sm leading-relaxed break-words">
                      {message.content}
                      {message.isEdited && (
                        <Badge variant="outline" className="text-xs h-4 ml-2">
                          <Edit className="h-3 w-3 mr-1" />
                          edited
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Message actions - shown on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Actions will be added here */}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
} 