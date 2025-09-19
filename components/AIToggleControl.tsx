"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bot, CheckCircle, Loader2, Database } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

interface AIToggleControlProps {
  projectId: Id<"projects">;
}

export default function AIToggleControl({ projectId }: AIToggleControlProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  // Get current AI settings
  const aiSettings = useQuery(api.ai.settings.getAISettings, { projectId });
  const enableAI = useMutation(api.ai.settings.enableAI);
  const disableAI = useMutation(api.ai.settings.disableAI);
  const indexAllProjectData = useAction(api.ai.rag.indexAllProjectData);
  const toggleIndexing = useMutation(api.ai.settings.toggleIndexing);

  const handleToggleAI = async (enabled: boolean) => {
    setIsToggling(true);
    try {
      if (enabled) {
        await enableAI({ projectId });
        toast.success("AI Assistant enabled! 🎉");
      } else {
        await disableAI({ projectId });
        toast.success("AI Assistant disabled");
      }
    } catch (error) {
      console.error("Error toggling AI:", error);
      toast.error(`Failed to ${enabled ? 'enable' : 'disable'} AI: ${error}`);
    } finally {
      setIsToggling(false);
    }
  };

  const handleToggleIndexing = async () => {
    if (!aiSettings?.isEnabled) {
      toast.error("AI must be enabled before indexing can be turned on");
      return;
    }

    setIsIndexing(true);
    try {
      const result = await toggleIndexing({ projectId });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error("Failed to toggle indexing");
      }
    } catch (error) {
      console.error("Error toggling indexing:", error);
      toast.error(`Failed to toggle indexing: ${error}`);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleReindexData = async () => {
    if (!aiSettings?.isEnabled || !aiSettings?.indexingEnabled) {
      toast.error("Both AI and indexing must be enabled to re-index data");
      return;
    }

    setIsIndexing(true);
    try {
      await indexAllProjectData({ projectId });
      toast.success("Project data re-indexed successfully! 🚀");
    } catch (error) {
      console.error("Error indexing data:", error);
      toast.error(`Failed to index data: ${error}`);
    } finally {
      setIsIndexing(false);
    }
  };

  const isEnabled = aiSettings?.isEnabled ?? false;
  const canToggle = !isToggling && !isIndexing;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          <CardTitle className="flex items-center gap-2">
            AI Assistant
            {isEnabled ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                <AlertCircle className="h-3 w-3 mr-1" />
                Disabled
              </Badge>
            )}
          </CardTitle>
        </div>
        <CardDescription>
          Enable AI-powered assistance for your project data (tasks, notes, shopping lists, surveys)
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Main Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <div className="font-medium">AI Assistant</div>
            <div className="text-sm text-muted-foreground">
              Enable intelligent project assistant with RAG search
            </div>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggleAI}
            disabled={!canToggle}
          />
        </div>

        {/* Indexing Controls */}
        {isEnabled && (
          <div className="space-y-4">
            {/* Toggle Indexing Button */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/50">
              <div className="space-y-1">
                <div className="font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Project Indexing
                </div>
                <div className="text-sm text-muted-foreground">
                  {aiSettings?.indexingEnabled
                    ? "Indexing is enabled - AI can search your project data"
                    : "Enable indexing to allow AI to search your project data"
                  }
                </div>
              </div>
              <Button
                onClick={handleToggleIndexing}
                disabled={!canToggle}
                variant={aiSettings?.indexingEnabled ? "destructive" : "default"}
                size="sm"
              >
                {isIndexing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    {aiSettings?.indexingEnabled ? "Turn Off Indexing" : "Turn On Indexing"}
                  </>
                )}
              </Button>
            </div>

            {/* Manual Re-index Button (only when indexing is ON) */}
            {aiSettings?.indexingEnabled && (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50/50">
                <div className="space-y-1">
                  <div className="font-medium flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Data Indexing
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Re-index all project data to ensure AI has the latest information
                  </div>
                </div>
                <Button
                  onClick={handleReindexData}
                  disabled={isIndexing}
                  variant="outline"
                  size="sm"
                >
                  {isIndexing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Indexing...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Re-index Data
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Loading States */}
        {isToggling && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{isEnabled ? "Disabling" : "Enabling"} AI system...</span>
          </div>
        )}

        {isIndexing && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Indexing project data... This may take a moment.</span>
          </div>
        )}

        {/* Information */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Enable auto-indexing to keep AI assistant up-to-date with your content</p>
          <p>• AI can answer questions about your tasks, notes, shopping lists, and surveys</p>
          <p>• Data is only accessible to your team members</p>
        </div>
      </CardContent>
    </Card>
  );
}
