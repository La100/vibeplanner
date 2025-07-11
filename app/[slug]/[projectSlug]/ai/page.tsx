"use client";

import {  useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useParams } from "next/navigation";


type IndexingStatus = "idle" | "indexing" | "done";

const AIPage = () => {
  const params = useParams<{ slug: string; projectSlug: string }>();
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  const project = useQuery(api.projects.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const sendMessage = useAction(api.ai.chat);
  const indexProject = useAction(api.ai.initIndex);

  const indexingStatus: IndexingStatus = project?.aiIndexingStatus || "idle";

  const handleSendMessage = async () => {
    if (!project || !message) return;

    setIsLoading(true);
    setChatHistory(prev => [...prev, { role: 'user', content: message }]);
    
    const response = await sendMessage({ projectId: project._id, message });
    
    if (response) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
    }
    
    setMessage("");
    setIsLoading(false);
  };

  const handleIndexProject = async () => {
    if (!project) return;
    setIsIndexing(true);
    await indexProject({ projectId: project._id });
    setIsIndexing(false);
  };

  const getIndexingButtonText = () => {
    if (isIndexing) return "Indexing...";
    
    switch (indexingStatus) {
      case 'indexing':
        return "Indexing...";
      case 'done':
        return "Ready";
      case 'idle':
      default:
        return "Index Project for AI";
    }
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">AI Assistant</h1>
        <Button 
          onClick={handleIndexProject} 
          variant="outline"
          disabled={indexingStatus !== 'idle' || isIndexing}
        >
          {getIndexingButtonText()}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto bg-muted/30 rounded-lg p-4 space-y-4">
        {chatHistory.map((chat, index) => (
          <div key={index} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-md p-3 rounded-lg ${chat.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>
              <p className="text-sm">{chat.content}</p>
            </div>
          </div>
        ))}
         {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-md p-3 rounded-lg bg-background">
              <p className="text-sm">Thinking...</p>
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
          placeholder="Ask the AI assistant about your project..."
          disabled={isLoading || indexingStatus !== 'done'}
        />
        <Button onClick={handleSendMessage} disabled={isLoading || indexingStatus !== 'done'}>
          {isLoading ? "Thinking..." : "Send"}
        </Button>
      </div>
    </div>
  );
};

export default AIPage; 