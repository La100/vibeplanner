"use client";

import { useState, useEffect, useRef } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@clerk/nextjs";
import { useProject } from '@/components/providers/ProjectProvider';
import { Sparkles, Send, RotateCcw, Loader2, RefreshCw, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

type IndexingStatus = "idle" | "indexing" | "done";

const AIAssistant = () => {
  const { user } = useUser();
  const { project } = useProject();
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);

  const sendMessage = useAction(api.ai_agent_simple.chatWithThread);
  const createThread = useAction(api.ai_agent_simple.createThread);
  const indexProject = useAction(api.ai_new.initIndex);
  const resetIndexing = useAction(api.testSeed.resetIndexingForProject);
  const updateAIKnowledge = useAction(api.ai_new.updateAIKnowledge);
  const generateUploadUrl = useMutation(api.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(api.files.addFile);

  const indexingStatus: IndexingStatus = project?.aiIndexingStatus || "idle";

  const handleSendMessage = async () => {
    if (!project || (!message.trim() && !selectedFile) || !user?.id) return;

    const userMessage = message.trim();
    let currentThreadId = threadId;

    setIsLoading(true);
    
    try {
      // If no thread exists, create one
      if (!currentThreadId) {
        currentThreadId = await createThread({
          projectId: project._id,
          userClerkId: user.id,
        });
        setThreadId(currentThreadId);
      }

      if (selectedFile) {
        setIsUploading(true);
        const uploadData = await generateUploadUrl({
          projectId: project._id,
          fileName: selectedFile.name,
        });

        const uploadResult = await fetch(uploadData.url, {
          method: "POST",
          headers: { "Content-Type": selectedFile.type },
          body: selectedFile,
        });

        if (!uploadResult.ok) {
          throw new Error("Upload failed");
        }

        const fileResult = await addFile({
          projectId: project._id,
          fileKey: uploadData.key,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
        });

        // Trigger text extraction for supported file types
        if (selectedFile.type === 'application/pdf' || 
            selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            selectedFile.type.startsWith('image/') ||
            selectedFile.type === 'text/plain') {
          
          // Note: This will be triggered in background
          console.log('Triggering text extraction for file:', fileResult);
          // TODO: Add action call to trigger text extraction
        }

        const userContent = userMessage || `Attached: ${selectedFile.name}`;
        setChatHistory(prev => [...prev, { role: 'user', content: userContent }]);
        setSelectedFile(null);
        setMessage("");
        setIsUploading(false);

      } else {
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setMessage("");
      }

      const result = await sendMessage({
        threadId: currentThreadId,
        message: userMessage,
        projectId: project._id,
        userClerkId: user.id,
      });
      
      setChatHistory(prev => [...prev, { role: 'assistant', content: result.response }]);
      
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      setChatHistory(prev => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${errorMessage}` }]);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
      setIsUploading(false);
      inputRef.current?.focus();
    }
  };

  const handleResetConversation = () => {
    setChatHistory([]);
    setThreadId(undefined);
    toast.info("Conversation has been reset.");
  };

  const handleIndexProject = async () => {
    if (!project) return;
    setIsIndexing(true);
    await indexProject({ projectId: project._id });
    setIsIndexing(false);
  };

  const handleResetIndexing = async () => {
    if (!project) return;
    await resetIndexing({ projectId: project._id });
  };

  const handleUpdateAIKnowledge = async () => {
    if (!project) return;
    
    setIsUpdating(true);
    setUpdateResult(null);
    
    try {
      const result = await updateAIKnowledge({ projectId: project._id });
      setUpdateResult(`✅ ${result.message} (${result.updatedTasks} tasks, ${result.updatedItems} items, ${result.updatedSurveys} surveys)`);
      
      // Auto-hide message after 5 seconds
      setTimeout(() => setUpdateResult(null), 5000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setUpdateResult(`❌ ${errorMessage}`);
      setTimeout(() => setUpdateResult(null), 5000);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 512MB for OpenAI Files API)
      if (file.size > 512 * 1024 * 1024) {
        toast.error("File size must be less than 512MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const getIndexingButtonText = () => {
    if (isIndexing) return "Indexing...";
    
    switch (indexingStatus) {
      case 'indexing':
        return "Indexing...";
      case 'done':
        const lastIndexed = project?.aiLastIndexedAt;
        const itemsCount = project?.aiIndexedItemsCount;
        if (lastIndexed) {
          const timeAgo = new Date(lastIndexed).toLocaleDateString();
          return `Re-index (${itemsCount} items, ${timeAgo})`;
        }
        return "Re-index Project";
      case 'idle':
      default:
        return "Index Project for AI";
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">AI Assistant</h1>
            <p className="text-sm text-muted-foreground">Ask questions about your project</p>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              onClick={handleResetConversation}
              variant="outline"
              size="sm"
              disabled={chatHistory.length === 0}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              New Chat
            </Button>

            {indexingStatus === 'indexing' && (
              <Button 
                onClick={handleResetIndexing} 
                variant="destructive"
                size="sm"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}
            
            {/* Update AI Knowledge Button - only show if project was indexed */}
            {indexingStatus === 'done' && (
              <Button 
                onClick={handleUpdateAIKnowledge}
                variant="secondary"
                size="sm"
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {isUpdating ? "Updating..." : "Update AI"}
              </Button>
            )}
            
            <Button 
              onClick={handleIndexProject} 
              variant="outline"
              disabled={indexingStatus === 'indexing' || isIndexing}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {getIndexingButtonText()}
            </Button>
          </div>
        </div>
      </div>

      {/* Update Result Message */}
      {updateResult && (
        <div className="border-b bg-background px-6 py-2">
          <p className="text-sm text-muted-foreground">{updateResult}</p>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          {chatHistory.length === 0 && (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-card border shadow-sm rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">Ready to help</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                I can help you with project insights, task management, team coordination, and much more.
              </p>
            </div>
          )}
          
          {chatHistory.map((chat, index) => (
            <div key={index} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${
                chat.role === 'user' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'bg-card border shadow-sm'
              } rounded-xl px-4 py-3`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{chat.content}</p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-card border shadow-sm rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-background p-6">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept="image/*,video/*,application/pdf,.doc,.docx,.txt,.json,.jsonl,.csv,.md,.py,.js,.ts,.html,.css,.xml,.rtf"
          className="hidden"
        />

        {indexingStatus !== 'done' && (
          <div className="mb-4 p-4 rounded-xl bg-muted border">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm">
                {indexingStatus === 'indexing' ? 'Indexing your project...' : 'Please index your project first to start chatting'}
              </span>
            </div>
          </div>
        )}

        {/* Selected file preview */}
        {selectedFile && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
            <span className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <div className="flex items-center gap-3">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isLoading && !isUploading && indexingStatus === 'done') {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={selectedFile ? "Add a message (optional)" : "Ask me anything about your project..."}
            disabled={isLoading || isUploading || indexingStatus !== 'done'}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={isLoading || isUploading || indexingStatus !== 'done'}
            onClick={handleAttachmentClick}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button 
            onClick={handleSendMessage} 
            disabled={isLoading || isUploading || indexingStatus !== 'done' || (!message.trim() && !selectedFile)}
            size="sm"
          >
            {isLoading || isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;