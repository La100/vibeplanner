"use client";

import { useState, useEffect, useRef } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@clerk/nextjs";
import { useProject } from '@/components/providers/ProjectProvider';
import { Send, RotateCcw, Loader2, Paperclip, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

const AIAssistant = () => {
  const { user } = useUser();
  const { project } = useProject();
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const sendMessage = useAction(api.ai.chatWithAgentStream);
  const createThread = useAction(api.ai.createThread);
  const generateUploadUrl = useMutation(api.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(api.files.addFile);
  // const analyzePDF = useAction(api.pdfAnalysis.analyzePDFWithGemini); // Temporarily disabled

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

        // Trigger analysis for supported file types
        if (selectedFile.type === 'application/pdf') {
          // PDF Analysis with Vertex AI - Temporarily disabled
          console.log('PDF analysis disabled for file:', fileResult);
          // TODO: Re-enable after fixing API generation
          /*
          try {
            await analyzePDF({
              fileId: fileResult,
              projectId: project._id,
            });
            toast.success("PDF analysis started - results will appear in chat context");
          } catch (error) {
            console.error('PDF analysis failed:', error);
            toast.error("PDF analysis failed");
          }
          */
        } else if (selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
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

      // Add empty assistant message immediately for instant feedback
      setChatHistory(prev => [...prev, { role: 'assistant', content: '' }]);

      const result = await sendMessage({
        threadId: currentThreadId,
        message: userMessage,
        projectId: project._id,
        userClerkId: user.id,
      });
      
      // Update the last message with the full response
      setChatHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: result.response };
        return updated;
      });
      
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


  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">AI Assistant</h1>
            <p className="text-sm text-muted-foreground">Ask questions about your project</p>
          </div>

          <Button 
            onClick={handleResetConversation}
            variant="outline"
            size="sm"
            disabled={chatHistory.length === 0}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
      </div>

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
                {chat.content === '' && chat.role === 'assistant' ? (
                  // Show typing indicator for empty assistant messages
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-sm text-muted-foreground">AI is thinking...</span>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{chat.content}</p>
                )}
              </div>
            </div>
          ))}
          
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


        {/* Selected file preview */}
        {selectedFile && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
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
            {selectedFile.type === 'application/pdf' && (
              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                PDF will be analyzed with AI for better context understanding
              </div>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-3">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isLoading && !isUploading) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={selectedFile ? "Add a message (optional)" : "Ask me anything about your project..."}
            disabled={isLoading || isUploading}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={isLoading || isUploading}
            onClick={handleAttachmentClick}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button 
            onClick={handleSendMessage} 
            disabled={isLoading || isUploading || (!message.trim() && !selectedFile)}
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