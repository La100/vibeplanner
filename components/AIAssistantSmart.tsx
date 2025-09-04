"use client";

import { useState, useEffect, useRef } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@clerk/nextjs";
import { useProject } from '@/components/providers/ProjectProvider';
import { Send, RotateCcw, Loader2, Paperclip, X, Sparkles, Database, Zap, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { UniversalConfirmationDialog } from "@/components/UniversalConfirmationDialog";
import { Id } from "@/convex/_generated/dataModel";

const AIAssistantSmart = () => {
  const { user } = useUser();
  const { project } = useProject();
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string; mode?: string; tokenUsage?: { totalTokens: number; estimatedCostUSD: number; }; }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [currentMode, setCurrentMode] = useState<'full' | 'smart' | null>(null);
  const [sessionTokens, setSessionTokens] = useState({ total: 0, cost: 0 });
  const [pendingItems, setPendingItems] = useState<{ type: 'task' | 'note' | 'shopping' | 'survey'; operation?: 'create' | 'edit'; data: Record<string, unknown>; updates?: Record<string, unknown>; originalItem?: Record<string, unknown>; }[]>([]); // New unified system
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [isCreatingContent, setIsCreatingContent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);

  // Use the new smart AI system
  const sendMessage = useAction(api.aiSmart.chatWithSmartAgent);
  const createThread = useAction(api.ai.createThread);
  const createConfirmedTask = useAction(api.aiSmart.createConfirmedTask);
  const createConfirmedNote = useAction(api.aiSmart.createConfirmedNote);
  const createConfirmedShoppingItem = useAction(api.aiSmart.createConfirmedShoppingItem);
  const createConfirmedSurvey = useAction(api.aiSmart.createConfirmedSurvey);
  const editConfirmedTask = useAction(api.aiSmart.editConfirmedTask);
  const editConfirmedNote = useAction(api.aiSmart.editConfirmedNote);
  const editConfirmedShoppingItem = useAction(api.aiSmart.editConfirmedShoppingItem);
  const editConfirmedSurvey = useAction(api.aiSmart.editConfirmedSurvey);
  const generateUploadUrl = useMutation(api.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(api.files.addFile);

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

        await addFile({
          projectId: project._id,
          fileKey: uploadData.key,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
        });

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
      setChatHistory(prev => [...prev, { role: 'assistant', content: '', mode: currentMode || undefined }]);

      // Use the smart AI system
      const result = await sendMessage({
        threadId: currentThreadId,
        message: userMessage,
        projectId: project._id,
        userClerkId: user.id,
      });
      
      // Update mode info
      setCurrentMode(result.mode as 'full' | 'smart');
      
      // Update session token usage
      if (result.tokenUsage) {
        setSessionTokens(prev => ({
          total: prev.total + result.tokenUsage.totalTokens,
          cost: prev.cost + result.tokenUsage.estimatedCostUSD
        }));
      }
      
      // Update the last message with the full response
      setChatHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { 
          role: 'assistant', 
          content: result.response,
          mode: result.mode,
          tokenUsage: result.tokenUsage
        };
        return updated;
      });

      // Handle pending items if any (new unified system)
      if (result.pendingItems && result.pendingItems.length > 0) {
        setPendingItems(result.pendingItems);
        setCurrentItemIndex(0);
        setIsConfirmationDialogOpen(true);
      }
      // Legacy support for pendingTasks
      else if (result.pendingTasks && result.pendingTasks.length > 0) {
        // Convert old format to new format
        const legacyItems = result.pendingTasks.map((task: unknown) => ({
          type: 'task',
          data: task
        }));
        setPendingItems(legacyItems);
        setCurrentItemIndex(0);
        setIsConfirmationDialogOpen(true);
      }
      
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
    setCurrentMode(null);
    setSessionTokens({ total: 0, cost: 0 });
    setPendingItems([]);
    setCurrentItemIndex(0);
    setIsConfirmationDialogOpen(false);
    toast.info("Conversation has been reset.");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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

  const handleContentConfirm = async () => {
    if (!project || pendingItems.length === 0) return;

    const currentItem = pendingItems[currentItemIndex];
    setIsCreatingContent(true);

    try {
      let result;

      // Call appropriate function based on operation type
      if (currentItem.operation === 'edit') {
        // Handle edit operations
        switch (currentItem.type) {
          case 'task':
            // Clean updates - remove technical fields that are only for UI display
            const cleanUpdates = { ...(currentItem.updates as Record<string, unknown>) };
            delete (cleanUpdates as Record<string, unknown>).assignedToName;
            
            result = await editConfirmedTask({
              taskId: currentItem.originalItem?._id as Id<"tasks">,
              updates: cleanUpdates
            });
            break;
          case 'note':
            result = await editConfirmedNote({
              noteId: currentItem.originalItem?._id as Id<"notes">,
              updates: currentItem.updates as Record<string, unknown>
            });
            break;
          case 'shopping':
            result = await editConfirmedShoppingItem({
              itemId: currentItem.originalItem?._id as Id<"shoppingListItems">,
              updates: currentItem.updates as Record<string, unknown>
            });
            break;
          case 'survey':
            result = await editConfirmedSurvey({
              surveyId: currentItem.originalItem?._id as Id<"surveys">,
              updates: currentItem.updates as Record<string, unknown>
            });
            break;
          default:
            throw new Error(`Nieznany typ zawartości do edycji: ${currentItem.type}`);
        }
      } else {
        // Handle create operations
        switch (currentItem.type) {
          case 'task':
            // Clean data - remove technical fields that are only for UI display
            const cleanTaskData = { ...(currentItem.data as Record<string, unknown>) };
            delete (cleanTaskData as Record<string, unknown>).assignedToName;
            
            result = await createConfirmedTask({
              projectId: project._id,
              taskData: cleanTaskData as { title: string; status?: "todo" | "in_progress" | "review" | "done"; description?: string; assignedTo?: string | null; priority?: "low" | "medium" | "high" | "urgent"; dueDate?: string; tags?: string[]; cost?: number; }
            });
            break;
          case 'note':
            result = await createConfirmedNote({
              projectId: project._id,
              noteData: currentItem.data as { title: string; content: string; }
            });
            break;
          case 'shopping':
            // Remove sectionName - it's only for UI display, not for DB
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { sectionName: _, ...shoppingItemData } = currentItem.data as { sectionName?: string; [key: string]: unknown; };
            result = await createConfirmedShoppingItem({
              projectId: project._id,
              itemData: shoppingItemData as { name: string; quantity: number; notes?: string; priority?: "low" | "medium" | "high" | "urgent"; buyBefore?: string; supplier?: string; category?: string; unitPrice?: number; sectionId?: Id<"shoppingListSections">; }
            });
            break;
          case 'survey':
            result = await createConfirmedSurvey({
              projectId: project._id,
              surveyData: currentItem.data as { title: string; isRequired: boolean; targetAudience: string; questions: string[]; description?: string; allowMultipleResponses?: boolean; }
            });
            break;
          default:
            throw new Error(`Nieznany typ zawartości: ${currentItem.type}`);
        }
      }

      if (result.success) {
        toast.success(result.message);
        
        // Add success message to chat
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: `✅ ${result.message}` 
        }]);

        // Move to next item or close dialog
        if (currentItemIndex < pendingItems.length - 1) {
          setCurrentItemIndex(prev => prev + 1);
        } else {
          setIsConfirmationDialogOpen(false);
          setPendingItems([]);
          setCurrentItemIndex(0);
        }
      }
    } catch (error) {
      console.error(`Error creating ${currentItem.type}:`, error);
      toast.error(`Failed to create ${currentItem.type}`);
    } finally {
      setIsCreatingContent(false);
    }
  };

  const handleContentCancel = () => {
    // Move to next item or close dialog
    if (currentItemIndex < pendingItems.length - 1) {
      setCurrentItemIndex(prev => prev + 1);
    } else {
      setIsConfirmationDialogOpen(false);
      setPendingItems([]);
      setCurrentItemIndex(0);
      toast.info("Content creation cancelled");
    }
  };

  const handleContentDialogClose = () => {
    setIsConfirmationDialogOpen(false);
    setPendingItems([]);
    setCurrentItemIndex(0);
    toast.info("Content creation cancelled");
  };

  const handleContentEdit = (updatedItem: { type: 'task' | 'note' | 'shopping' | 'survey'; operation?: 'create' | 'edit'; data: Record<string, unknown>; updates?: Record<string, unknown>; originalItem?: Record<string, unknown>; }) => {
    // Update the current item in pendingItems array
    setPendingItems(prev => {
      const updated = [...prev];
      updated[currentItemIndex] = updatedItem;
      return updated;
    });
    toast.info("Element został zaktualizowany");
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
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold">Smart AI Assistant</h1>
              {currentMode && (
                <Badge variant={currentMode === 'full' ? 'default' : 'secondary'} className="text-xs">
                  {currentMode === 'full' ? (
                    <>
                      <Database className="h-3 w-3 mr-1" />
                      Full Mode
                    </>
                  ) : (
                    <>
                      <Zap className="h-3 w-3 mr-1" />
                      Smart Mode
                    </>
                  )}
                </Badge>
              )}
              {sessionTokens.total > 0 && (
                <Badge variant="outline" className="text-xs">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {sessionTokens.total.toLocaleString()} tokens (~${sessionTokens.cost.toFixed(4)})
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {currentMode === 'full' 
                ? "Complete project data (small project)"
                : currentMode === 'smart'
                ? "Recent data + intelligent search (large project)"
                : "Automatically adapts to your project size"
              }
            </p>
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
              <h3 className="font-semibold mb-2">Smart AI Ready</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                Start by saying hello, or ask me about your project tasks, budget, timeline, or any specific questions.
              </p>
              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  Small projects: Full data
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Large projects: Smart mode
                </div>
              </div>
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
                  // Show smart typing indicator
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {currentMode === 'smart' ? 'Smart AI analyzing...' : 'AI thinking...'}
                    </span>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{chat.content}</p>
                    {chat.role === 'assistant' && (chat.mode || chat.tokenUsage) && (
                      <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2 flex-wrap">
                        {chat.mode && (
                          <Badge variant="outline" className="text-xs">
                            {chat.mode === 'full' ? (
                              <>
                                <Database className="h-2 w-2 mr-1" />
                                Complete project data
                              </>
                            ) : (
                              <>
                                <Zap className="h-2 w-2 mr-1" />
                                Recent + historical search
                              </>
                            )}
                          </Badge>
                        )}
                        {chat.tokenUsage && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            <DollarSign className="h-2 w-2 mr-1" />
                            {chat.tokenUsage.totalTokens.toLocaleString()} tokens (${chat.tokenUsage.estimatedCostUSD.toFixed(4)})
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
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
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              File content will be extracted and made available to AI
            </div>
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
            placeholder={selectedFile ? "Add a message (optional)" : "Ask me about tasks, budget, timeline, or say hello..."}
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

      {/* Universal Confirmation Dialog */}
      {pendingItems.length > 0 && (
        <UniversalConfirmationDialog
          isOpen={isConfirmationDialogOpen}
          onClose={handleContentDialogClose}
          onConfirm={handleContentConfirm}
          onCancel={handleContentCancel}
          onEdit={handleContentEdit}
          contentItem={pendingItems[currentItemIndex] as { type: 'task' | 'note' | 'shopping' | 'survey'; operation?: 'create' | 'edit'; data: Record<string, unknown>; updates?: Record<string, unknown>; originalItem?: Record<string, unknown>; }}
          isLoading={isCreatingContent}
          itemNumber={currentItemIndex + 1}
          totalItems={pendingItems.length}
        />
      )}
    </div>
  );
};

export default AIAssistantSmart;
