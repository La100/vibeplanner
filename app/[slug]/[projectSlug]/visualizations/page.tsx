"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useProject } from "@/components/providers/ProjectProvider";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ArrowUp,
  ImagePlus,
  X,
  Download,
  Save,
  Check,
  RotateCcw,
  Image as ImageIcon,
  Video,
  Sparkles,
  Settings2,
  Square,
  RectangleHorizontal,
  RectangleVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ReferenceImage {
  base64: string;
  mimeType: string;
  name: string;
  preview: string;
  storageKey?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  imageStorageKey?: string;
  videoUrl?: string;
  videoStorageKey?: string;
  referenceImages?: ReferenceImage[];
  timestamp: Date;
  saved?: boolean;
  type?: "image" | "video";
  aspectRatio?: string;
}

type GenerationMode = "image" | "video";
type AspectRatio = "16:9" | "9:16" | "1:1";

export default function VisualizationsPage() {
  const { project } = useProject();
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("image");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [useSystemPrompt, setUseSystemPrompt] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const generateVisualization = useAction(api.ai.imageGen.generation.generateVisualization);
  const generateVideo = useAction(api.ai.imageGen.videoGeneration.generateVideo);
  const saveGeneratedImage = useAction(api.ai.imageGen.generation.saveGeneratedImage);
  const getUploadUrl = useAction(api.ai.imageGen.generation.getUploadUrl);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const resetChat = () => {
    setMessages([]);
    setReferenceImages([]);
    setPrompt("");
    setSelectedImage(null);
    toast.success("Chat reset");
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processReferenceFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0 || isUploading) return;

    setIsUploading(true);
    const newImages: ReferenceImage[] = [];

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image file`);
          continue;
        }

        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 20MB)`);
          continue;
        }

        let storageKey: string | undefined;
        try {
          const { url, key } = await getUploadUrl({ 
            projectId: project._id, 
            fileName: file.name, 
            fileType: file.type 
          });
          
          await fetch(url, { 
            method: "PUT", 
            body: file, 
            headers: { "Content-Type": file.type } 
          });
          
          storageKey = key;
        } catch (err) {
          console.error("Failed to upload image:", err);
          toast.error(`Failed to upload ${file.name}, using local preview only (may be limited)`);
        }

        const base64 = await readFileAsBase64(file);
        const preview = await readFileAsDataUrl(file);

        newImages.push({
          base64,
          mimeType: file.type,
          name: file.name,
          preview,
          storageKey,
        });
      }

      if (newImages.length > 0) {
        setReferenceImages(prev => [...prev, ...newImages]);
      }
    } catch (error) {
      console.error("Error processing images:", error);
      toast.error("Error processing images");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processReferenceFiles(files);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedFiles = e.clipboardData?.files;
    if (!pastedFiles || pastedFiles.length === 0) return;
    const imageFiles = Array.from(pastedFiles).filter(file => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    await processReferenceFiles(imageFiles);
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
    if (!prompt.trim() || isGenerating || isUploading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      referenceImages: referenceImages.length > 0 ? [...referenceImages] : undefined,
      timestamp: new Date(),
      type: generationMode,
      aspectRatio: generationMode === "video" ? aspectRatio : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setPrompt("");
    setIsGenerating(true);

    const sentReferenceImages = [...referenceImages];
    handleRemoveReference();

    setTimeout(scrollToBottom, 100);

    try {
      if (generationMode === "video") {
        // Video generation
        const sourceImage = sentReferenceImages[0]; // Use first reference image as source
        
        const result = await generateVideo({
          prompt: userMessage.content,
          sourceImageBase64: sourceImage?.storageKey ? undefined : sourceImage?.base64,
          sourceImageMimeType: sourceImage?.mimeType,
          sourceImageStorageKey: sourceImage?.storageKey,
          projectId: project._id,
          aspectRatio: aspectRatio,
        });

        if (result.success && result.videoUrl) {
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Video generated successfully!",
            videoUrl: result.videoUrl,
            videoStorageKey: result.videoStorageKey,
            timestamp: new Date(),
            saved: true, // Videos are auto-saved
            type: "video",
            aspectRatio: aspectRatio,
          };
          setMessages((prev) => [...prev, assistantMessage]);
          toast.success("Video generated!");
        } else {
          const errorMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.error || "Video generation failed. Please try again.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          toast.error(result.error || "Video generation failed");
        }
      } else {
        // Image generation (existing logic)
        const history = messages.map(msg => ({
          role: msg.role === "user" ? "user" as const : "model" as const,
          text: msg.content,
          imageStorageKey: msg.role === "assistant" ? msg.imageStorageKey : undefined,
          imageBase64: (msg.role === "assistant" && !msg.imageStorageKey) ? msg.imageBase64 : undefined,
          imageMimeType: msg.role === "assistant" ? msg.imageMimeType : undefined,
        }));

        const result = await generateVisualization({
          prompt: userMessage.content,
          referenceImages: sentReferenceImages.length > 0 
            ? sentReferenceImages.map(img => ({
                base64: img.storageKey ? undefined : img.base64,
                storageKey: img.storageKey,
                mimeType: img.mimeType,
                name: img.name,
              }))
            : undefined,
          projectId: project._id,
          history: history.length > 0 ? history : undefined,
          useSystemPrompt,
        });

        if (result.success && result.imageBase64) {
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.textResponse || "",
            imageBase64: result.imageBase64,
            imageMimeType: result.mimeType,
            imageStorageKey: result.imageStorageKey,
            imageUrl: result.fileUrl || `data:${result.mimeType};base64,${result.imageBase64}`,
            timestamp: new Date(),
            saved: false, // User must click Save to add to project files
            type: "image",
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

  const handleDownload = async (message: Message) => {
    if (!message.imageUrl) return;

    try {
      // Fetch image as blob to handle cross-origin URLs
      const response = await fetch(message.imageUrl);
      const blob = await response.blob();
      
      // Create object URL from blob
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `visualization-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up object URL
      URL.revokeObjectURL(blobUrl);
      toast.success("Downloaded");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Download failed");
    }
  };

  const handleSave = async (message: Message) => {
    if (message.saved) return;
    if ((!message.imageBase64 && !message.imageStorageKey) || !message.imageMimeType) return;

    setIsSaving(message.id);

    try {
      const messageIndex = messages.findIndex((m) => m.id === message.id);
      const userPrompt = messageIndex > 0 
        ? messages.slice(0, messageIndex).reverse().find((m) => m.role === "user")?.content 
        : "visualization";

      // Try to save using key if available, fallback to base64 (which might fail if large)
      const result = await saveGeneratedImage({
        imageBase64: message.imageStorageKey ? undefined : message.imageBase64,
        imageStorageKey: message.imageStorageKey,
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

  const imageSuggestions = [
    "Minimalist Scandinavian living room with natural oak floors",
    "Japanese zen garden with stone pathway and bamboo",
    "Industrial loft conversion with exposed steel beams",
    "Mediterranean terrace with olive trees at sunset",
  ];

  const videoSuggestions = [
    "A slow camera pan across a modern minimalist kitchen at golden hour",
    "Gentle waves lapping at a pristine beach with palm trees swaying",
    "Time-lapse of clouds moving over a contemporary glass building",
    "A peaceful walk through a Japanese garden with koi pond",
  ];

  const suggestions = generationMode === "video" ? videoSuggestions : imageSuggestions;

  const getAspectRatioIcon = (ratio: AspectRatio) => {
    switch (ratio) {
      case "16:9": return <RectangleHorizontal className="h-4 w-4" />;
      case "9:16": return <RectangleVertical className="h-4 w-4" />;
      case "1:1": return <Square className="h-4 w-4" />;
    }
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] bg-background overflow-hidden">
      {/* Background Elements from Landing Page */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50 dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] pointer-events-none"></div>
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-100 blur-[100px] opacity-20 dark:bg-purple-900/20 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-blue-100 blur-[100px] opacity-20 dark:bg-blue-900/20 pointer-events-none"></div>

      {/* Floating Mode Toggle - Top Right */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 rounded-full px-3 text-muted-foreground hover:text-foreground hover:bg-muted/40"
          onClick={resetChat}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset chat
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-9 rounded-full px-4 shadow-sm backdrop-blur-md border border-border/60 transition-all",
            useSystemPrompt
              ? "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600"
              : "bg-background/70 text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setUseSystemPrompt((prev) => !prev)}
          title="Toggle built-in architectural prompt for image generations"
        >
          <Settings2 className="h-4 w-4 mr-2" />
          {useSystemPrompt ? "System prompt on" : "System prompt off"}
        </Button>
        <div className="flex bg-background/50 backdrop-blur-md border border-border/50 rounded-full p-1 shadow-sm">
          <button
            onClick={() => setGenerationMode("image")}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
              generationMode === "image"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Image
          </button>
          <button
            onClick={() => setGenerationMode("video")}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
              generationMode === "video"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Video className="h-3.5 w-3.5" />
            Video
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto relative z-10">
        {messages.length === 0 && !isGenerating ? (
          <div className="h-full flex flex-col items-center justify-center px-6">
            <div className="max-w-4xl w-full text-center space-y-12">
              {/* Hero Section */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <h1 className="text-6xl md:text-7xl font-bold tracking-tight text-foreground font-display">
                  Visualizations
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Describe your <span className="italic font-serif text-foreground">vision</span>. 
                  AI brings it to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-semibold">life</span>.
                </p>
              </motion.div>

              {/* Suggestions Grid */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto"
              >
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    onClick={() => setPrompt(suggestion)}
                    className={cn(
                      "group relative overflow-hidden rounded-3xl p-6 text-left transition-all duration-300",
                      "bg-white/40 dark:bg-white/5 border border-white/10 shadow-sm",
                      "hover:bg-white/60 hover:shadow-md hover:-translate-y-1",
                      "backdrop-blur-sm"
                    )}
                  >
                    <div className="relative z-10 flex items-start gap-4">
                      <div className={cn(
                        "mt-1 h-8 w-8 shrink-0 rounded-full flex items-center justify-center",
                        index % 2 === 0 ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600"
                      )}>
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
                        {suggestion}
                      </p>
                    </div>
                    {/* Decorative background pattern on hover */}
                    <div className="absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-transparent via-white/20 to-transparent"></div>
                  </button>
                ))}
              </motion.div>
            </div>
          </div>
        ) : (
          <div className={cn(
            "max-w-5xl mx-auto px-6 py-8 space-y-12",
            messages.length === 0 && isGenerating 
              ? "h-full flex flex-col items-center justify-center" 
              : "pb-48"
          )}>
            {/* Reset button - only show when there are messages */}
            {messages.length > 0 && (
              <div className="flex justify-end sticky top-0 z-20 pt-2 pb-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMessages([]);
                    toast.success("Chat cleared");
                  }}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full px-4 backdrop-blur-sm"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  New session
                </Button>
              </div>
            )}
            
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={cn("flex flex-col gap-4", message.role === "user" ? "items-end" : "items-start")}
              >
                {message.role === "user" ? (
                  <div className="max-w-[85%]">
                    <div className="bg-foreground text-background px-6 py-4 rounded-3xl rounded-tr-sm shadow-lg">
                      <p className="text-lg leading-relaxed">{message.content}</p>
                    </div>
                    {message.referenceImages && message.referenceImages.length > 0 && (
                      <div className="flex justify-end gap-2 mt-3 flex-wrap">
                        {message.referenceImages.map((img, idx) => (
                          <motion.img 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            key={idx}
                            src={img.preview} 
                            alt=""
                            className="w-24 h-24 object-cover rounded-2xl cursor-pointer hover:opacity-90 shadow-sm border border-border/20"
                            onClick={() => setSelectedImage(img.preview)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full max-w-4xl">
                    {/* Generated Content Card */}
                    <div className="relative rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-2xl overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/20 to-background z-0"></div>
                        
                        <div className="relative z-10 p-1">
                          {message.content && !message.imageUrl && !message.videoUrl && (
                            <div className="p-8">
                              <p className="text-lg text-muted-foreground leading-relaxed">
                                {message.content}
                              </p>
                            </div>
                          )}

                          {/* Video Player */}
                          {message.videoUrl && (
                            <div className="relative bg-black/5 rounded-[1.25rem] overflow-hidden">
                              <video
                                src={message.videoUrl}
                                controls
                                className={cn(
                                  "w-full h-auto object-contain mx-auto",
                                  message.aspectRatio === "9:16" ? "max-h-[80vh] max-w-[45vh]" : "max-h-[70vh]"
                                )}
                                poster=""
                              >
                                Your browser does not support the video tag.
                              </video>
                              
                              {/* Overlay Actions */}
                              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-10 px-4 bg-white/90 hover:bg-white text-foreground shadow-lg rounded-full backdrop-blur-md"
                                  onClick={() => {
                                    if (message.videoUrl) {
                                      const link = document.createElement("a");
                                      link.href = message.videoUrl;
                                      link.download = `video-${Date.now()}.mp4`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      toast.success("Downloaded");
                                    }
                                  }}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </Button>
                                {message.saved && (
                                  <div className="h-10 px-4 bg-emerald-500/90 text-white rounded-full flex items-center shadow-lg backdrop-blur-md">
                                    <Check className="h-4 w-4 mr-2" />
                                    Saved
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Image Display */}
                          {message.imageUrl && !message.videoUrl && (
                            <div className="relative bg-black/5 rounded-[1.25rem] overflow-hidden">
                              <img
                                src={message.imageUrl}
                                alt="Generated visualization"
                                className="w-full h-auto max-h-[70vh] object-contain cursor-pointer transition-transform duration-500 group-hover:scale-[1.01]"
                                onClick={() => setSelectedImage(message.imageUrl || null)}
                              />
                              
                              {/* Overlay Actions */}
                              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-10 px-4 bg-white/90 hover:bg-white text-foreground shadow-lg rounded-full backdrop-blur-md"
                                  onClick={() => handleDownload(message)}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className={cn(
                                    "h-10 px-4 shadow-lg rounded-full backdrop-blur-md transition-all",
                                    message.saved 
                                      ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                                      : "bg-white/90 hover:bg-white text-foreground"
                                  )}
                                  onClick={() => handleSave(message)}
                                  disabled={isSaving === message.id || message.saved}
                                >
                                  {isSaving === message.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : message.saved ? (
                                    <>
                                      <Check className="h-4 w-4 mr-2" />
                                      Saved
                                    </>
                                  ) : (
                                    <>
                                      <Save className="h-4 w-4 mr-2" />
                                      Save
                                    </>
                                  )}
                                </Button>
                              </div>

                              {/* Fullscreen hint */}
                              <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                <div className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md">
                                  Click to expand
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                    </div>
                    
                    {/* Caption if available */}
                    {message.content && (message.imageUrl || message.videoUrl) && (
                      <p className="mt-4 text-muted-foreground text-sm ml-4 italic font-serif">
                        {message.content}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            ))}

            {/* Generating state */}
            {isGenerating && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex flex-col items-center gap-6 text-muted-foreground",
                  messages.length === 0 ? "text-center" : "max-w-4xl"
                )}
              >
                <div className="relative h-12 w-12 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-muted-foreground/20"></div>
                  <div className="absolute inset-0 rounded-full border-t-2 border-foreground animate-spin"></div>
                </div>
                <span className="text-xl font-light animate-pulse">
                  {generationMode === "video" 
                    ? "Dreaming up your video scene..." 
                    : "Visualizing your concept..."}
                </span>
              </motion.div>
            )}

            <div ref={messagesEndRef} className="h-8" />
          </div>
        )}
      </div>

      {/* Floating Input Area */}
      <div className="absolute bottom-6 left-0 right-0 px-6 z-50 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <motion.form 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
            onSubmit={handleSubmit}
            className={cn(
              "relative rounded-[2rem] p-2",
              "bg-background/80 backdrop-blur-xl border border-white/20 shadow-2xl dark:border-white/10",
              "transition-all duration-300",
              "focus-within:ring-1 focus-within:ring-white/20"
            )}
          >
            {/* Reference Images Preview - Floating above */}
            <AnimatePresence>
              {referenceImages.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: -10, height: "auto" }}
                  exit={{ opacity: 0, y: 10, height: 0 }}
                  className="absolute bottom-full left-4 mb-2 flex flex-wrap items-center gap-2"
                >
                  {referenceImages.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img.preview}
                        alt={img.name}
                        className="w-16 h-16 object-cover rounded-xl border-2 border-white shadow-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md scale-90 group-hover:scale-100"
                        onClick={() => handleRemoveReference(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-end gap-3 pl-4 pr-3 py-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              
              {/* Actions Group */}
              <div className="flex items-center gap-2 pb-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  title="Add reference image"
                >
                  {isUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                </Button>
                
                {/* Aspect Ratio - Now here next to file upload, ONLY visible in video mode */}
                {generationMode === "video" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 px-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors gap-2"
                        title="Select Aspect Ratio"
                      >
                        {getAspectRatioIcon(aspectRatio)}
                        <span className="text-xs font-medium">{aspectRatio}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuLabel>Aspect Ratio</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setAspectRatio("16:9")}>
                        <RectangleHorizontal className="mr-2 h-4 w-4" />
                        <span>16:9 Widescreen</span>
                        {aspectRatio === "16:9" && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAspectRatio("9:16")}>
                        <RectangleVertical className="mr-2 h-4 w-4" />
                        <span>9:16 Vertical</span>
                        {aspectRatio === "9:16" && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAspectRatio("1:1")}>
                        <Square className="mr-2 h-4 w-4" />
                        <span>1:1 Square</span>
                        {aspectRatio === "1:1" && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Separator */}
              <div className="w-px h-8 bg-border/50 mb-1.5 hidden sm:block" />

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
              isUploading 
                ? "Uploading images..." 
                : generationMode === "video"
                  ? "Describe the video scene you imagine..."
                  : "Describe the visualization you imagine..."
                }
              rows={1}
              disabled={isUploading}
              onPaste={handlePaste}
              className={cn(
                "flex-1 resize-none bg-transparent",
                "text-base placeholder:text-muted-foreground/50",
                "focus:outline-none",
                "py-2.5 px-2",
                  "max-h-[200px] min-h-[44px]"
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
                disabled={!prompt.trim() || isGenerating || isUploading}
                className={cn(
                  "h-10 w-10 rounded-full",
                  "bg-foreground hover:bg-foreground/90 text-background shadow-md",
                  "transition-all duration-200 hover:scale-105 active:scale-95",
                  "disabled:opacity-50 disabled:hover:scale-100"
                )}
              >
                {isGenerating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowUp className="h-5 w-5" />
                )}
              </Button>
            </div>
          </motion.form>
          
          <p className="text-center text-xs text-muted-foreground/40 mt-4 pb-2">
            AI can make mistakes. Review generated visuals carefully.
          </p>
        </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/95 backdrop-blur-xl z-50 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setSelectedImage(null)}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-foreground transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={selectedImage} 
              alt="Full size visualization"
              className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
