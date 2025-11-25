"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useProject } from "@/components/providers/ProjectProvider";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Loader2,
  ArrowUp,
  ImagePlus,
  X,
  Download,
  Save,
  Check,
  RotateCcw,
} from "lucide-react";

interface ReferenceImage {
  base64: string;
  mimeType: string;
  name: string;
  preview: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  referenceImages?: ReferenceImage[];
  timestamp: Date;
  saved?: boolean;
}

export default function VisualizationsPage() {
  const { project } = useProject();
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const generateVisualization = useAction(api.ai.imageGeneration.generateVisualization);
  const saveGeneratedImage = useAction(api.ai.imageGeneration.saveGeneratedImage);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Process all selected files
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }

      if (file.size > 4 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 4MB)`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(",")[1];
        setReferenceImages(prev => [...prev, {
          base64,
          mimeType: file.type,
          name: file.name,
          preview: event.target?.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveReference = (index?: number) => {
    if (index !== undefined) {
      setReferenceImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setReferenceImages([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      referenceImages: referenceImages.length > 0 ? [...referenceImages] : undefined,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setPrompt("");
    setIsGenerating(true);

    const sentReferenceImages = [...referenceImages];
    handleRemoveReference();

    setTimeout(scrollToBottom, 100);

    try {
      // Build history from previous messages (excluding the current one we just added)
      const history = messages.map(msg => ({
        role: msg.role === "user" ? "user" as const : "model" as const,
        text: msg.content,
        hasImage: !!msg.imageUrl,
      }));

      const result = await generateVisualization({
        prompt: userMessage.content,
        referenceImages: sentReferenceImages.length > 0 
          ? sentReferenceImages.map(img => ({
              base64: img.base64,
              mimeType: img.mimeType,
              name: img.name,
            }))
          : undefined,
        projectId: project._id,
        history: history.length > 0 ? history : undefined,
      });

      if (result.success && result.imageBase64) {
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.textResponse || "",
          imageBase64: result.imageBase64,
          imageMimeType: result.mimeType,
          imageUrl: `data:${result.mimeType};base64,${result.imageBase64}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.error || "Generation failed. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        toast.error(result.error || "Generation failed");
      }
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      toast.error("Generation failed");
    } finally {
      setIsGenerating(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleDownload = (message: Message) => {
    if (!message.imageUrl) return;

    const link = document.createElement("a");
    link.href = message.imageUrl;
    link.download = `visualization-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Downloaded");
  };

  const handleSave = async (message: Message) => {
    if (!message.imageBase64 || !message.imageMimeType) return;

    setIsSaving(message.id);

    try {
      const messageIndex = messages.findIndex((m) => m.id === message.id);
      const userPrompt = messageIndex > 0 
        ? messages.slice(0, messageIndex).reverse().find((m) => m.role === "user")?.content 
        : "visualization";

      const result = await saveGeneratedImage({
        imageBase64: message.imageBase64,
        mimeType: message.imageMimeType,
        fileName: `visualization-${Date.now()}`,
        projectId: project._id,
        prompt: userPrompt || "AI Generated Visualization",
      });

      if (result.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id ? { ...m, saved: true } : m
          )
        );
        toast.success("Saved to files");
      } else {
        toast.error(result.error || "Save failed");
      }
    } catch (error) {
      toast.error(`Failed: ${(error as Error).message}`);
    } finally {
      setIsSaving(null);
    }
  };

  const suggestions = [
    "Minimalist Scandinavian living room with natural oak floors",
    "Japanese zen garden with stone pathway and bamboo",
    "Industrial loft conversion with exposed steel beams",
    "Mediterranean terrace with olive trees at sunset",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-6">
            <div className="max-w-2xl w-full text-center space-y-12">
              {/* Hero */}
              <div className="space-y-4">
                <h1 className="text-4xl font-light tracking-tight text-foreground">
                  Visualizations
                </h1>
                <p className="text-muted-foreground text-lg font-light">
                  Describe your vision. AI brings it to life.
                </p>
              </div>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setPrompt(suggestion)}
                    className={cn(
                      "group text-left p-5 rounded-xl",
                      "border border-border/50 bg-card/50",
                      "hover:bg-card hover:border-border hover:shadow-sm",
                      "transition-all duration-200 ease-out"
                    )}
                  >
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {suggestion}
                    </span>
                  </button>
                ))}
              </div>

              {/* Subtle hint */}
              <p className="text-xs text-muted-foreground/60">
                Attach a reference image for style guidance
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
            {/* Reset button */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMessages([]);
                  toast.success("Chat cleared");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                New chat
              </Button>
            </div>
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={cn(
                  "animate-in fade-in-0 slide-in-from-bottom-4 duration-300",
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {message.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] space-y-2">
                      <div className="bg-primary text-primary-foreground px-5 py-3 rounded-2xl rounded-tr-md">
                        <p className="text-sm leading-relaxed">{message.content}</p>
                      </div>
                      {message.referenceImages && message.referenceImages.length > 0 && (
                        <div className="flex justify-end gap-2 mt-2 flex-wrap">
                          {message.referenceImages.map((img, idx) => (
                            <img 
                              key={idx}
                              src={img.preview} 
                              alt=""
                              className="w-20 h-20 object-cover rounded-xl cursor-pointer hover:opacity-90"
                              onClick={() => setSelectedImage(img.preview)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {message.content && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {message.content}
                      </p>
                    )}
                    {message.imageUrl && (
                      <div className="space-y-3">
                        <div className="relative group rounded-2xl bg-muted inline-block">
                          <img
                            src={message.imageUrl}
                            alt="Generated visualization"
                            className="max-w-full max-h-[60vh] object-contain rounded-2xl cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => setSelectedImage(message.imageUrl || null)}
                          />
                          {/* Hover overlay with actions */}
                          <div className={cn(
                            "absolute inset-0 bg-black/0 group-hover:bg-black/20",
                            "flex items-end justify-end p-4 gap-2",
                            "opacity-0 group-hover:opacity-100",
                            "transition-all duration-200"
                          )}>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-9 px-3 bg-white/90 hover:bg-white text-foreground shadow-lg"
                              onClick={() => handleDownload(message)}
                            >
                              <Download className="h-4 w-4 mr-1.5" />
                              Download
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className={cn(
                                "h-9 px-3 shadow-lg",
                                message.saved 
                                  ? "bg-emerald-500 hover:bg-emerald-500 text-white" 
                                  : "bg-white/90 hover:bg-white text-foreground"
                              )}
                              onClick={() => handleSave(message)}
                              disabled={isSaving === message.id || message.saved}
                            >
                              {isSaving === message.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : message.saved ? (
                                <>
                                  <Check className="h-4 w-4 mr-1.5" />
                                  Saved
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-1.5" />
                                  Save
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Generating state */}
            {isGenerating && (
              <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm">Creating visualization...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <form onSubmit={handleSubmit}>
            {/* Reference Images Preview */}
            {referenceImages.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 p-2 bg-muted/50 rounded-xl">
                {referenceImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img.preview}
                      alt={img.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveReference(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground ml-2">
                  {referenceImages.length} image{referenceImages.length > 1 ? 's' : ''} attached
                </p>
              </div>
            )}

            {/* Input Container */}
            <div className={cn(
              "flex items-end gap-2 p-2 rounded-2xl",
              "border border-border/50 bg-card",
              "focus-within:border-border focus-within:shadow-sm",
              "transition-all duration-200"
            )}>
              {/* Image Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
                title="Add reference image"
              >
                <ImagePlus className="h-5 w-5" />
              </Button>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your visualization..."
                rows={1}
                className={cn(
                  "flex-1 resize-none bg-transparent",
                  "text-sm placeholder:text-muted-foreground/60",
                  "focus:outline-none",
                  "py-2.5 px-1",
                  "max-h-[200px]"
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />

              {/* Send Button */}
              <Button
                type="submit"
                size="icon"
                disabled={!prompt.trim() || isGenerating}
                className={cn(
                  "h-10 w-10 shrink-0 rounded-xl",
                  "bg-primary hover:bg-primary/90",
                  "disabled:opacity-30"
                )}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X className="h-8 w-8" />
          </button>
          <img 
            src={selectedImage} 
            alt="Full size visualization"
            className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
