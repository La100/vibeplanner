"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, Wand2, Upload, User } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ASSISTANT_PRESETS, getPreset } from "@/convex/ai/presets";

interface CreateAssistantViewProps {
  teamId: Id<"teams">;
  onCancel: () => void;
}

export function CreateAssistantView({ teamId, onCancel }: CreateAssistantViewProps) {
  const router = useRouter();
  const createProject = useMutation(apiAny.projects.createProjectInOrg);
  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);
  const setProjectImageFromFileKey = useMutation(apiAny.projects.setProjectImageFromFileKey);

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const selectedPreset = selectedPresetId ? getPreset(selectedPresetId) : null;
  const isCustom = selectedPresetId === "custom";

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image is too large (max 5MB)");
      return;
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!selectedPresetId) {
      toast.error("Please select an assistant type");
      return;
    }

    if (isCustom && !customName.trim()) {
      toast.error("Please enter a name");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createProject({
        name: isCustom ? customName : selectedPreset?.name || "",
        customAiPrompt: isCustom && customPrompt ? customPrompt : undefined,
        assistantPreset: isCustom ? undefined : selectedPresetId,
        assistantOnboardingEnabled: isCustom ? true : undefined,
        teamId,
      });

      // Upload image if provided
      if (imageFile && result?.id && isCustom) {
        try {
          const uploadData = await generateUploadUrl({
            projectId: result.id,
            fileName: imageFile.name,
            origin: "general",
            fileSize: imageFile.size,
          });
          await fetch(uploadData.url, {
            method: "PUT",
            headers: { "Content-Type": imageFile.type },
            body: imageFile,
          });
          await addFile({
            projectId: result.id,
            fileKey: uploadData.key,
            fileName: imageFile.name,
            fileType: imageFile.type,
            fileSize: imageFile.size,
            origin: "general",
          });
          await setProjectImageFromFileKey({
            projectId: result.id,
            fileKey: uploadData.key,
          });
        } catch (err) {
          console.error(err);
          toast.error("Created, but image failed to upload");
        }
      }

      toast.success("Assistant created");
      router.push(`/organisation/projects/${result.slug}`);
    } catch (error) {
      toast.error("Failed to create assistant");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const presets = ASSISTANT_PRESETS.filter(p => p.id !== "custom");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">New Assistant</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Choose a personality or create your own
              </p>
            </div>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="space-y-12">
          {/* Presets Grid */}
          <div>
            <h2 className="text-lg font-medium mb-6">Choose a preset</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {presets.map((preset) => (
                <motion.div
                  key={preset.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "relative cursor-pointer group",
                    selectedPresetId === preset.id && "ring-2 ring-primary ring-offset-2 rounded-2xl"
                  )}
                  onClick={() => setSelectedPresetId(preset.id)}
                >
                  <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card transition-all hover:border-border hover:shadow-lg">
                    {/* Image */}
                    <div className="aspect-[3/4] overflow-hidden bg-muted">
                      {preset.image ? (
                        <img
                          src={preset.image}
                          alt={preset.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : preset.gradient ? (
                        <div className={cn("w-full h-full bg-gradient-to-br", preset.gradient)} />
                      ) : (
                        <div className="w-full h-full bg-muted" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-medium text-sm mb-1">{preset.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {preset.description}
                      </p>
                    </div>

                    {/* Selected indicator */}
                    {selectedPresetId === preset.id && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Custom Option */}
          <div>
            <h2 className="text-lg font-medium mb-6">Or create your own</h2>
            <div
              className={cn(
                "rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all",
                selectedPresetId === "custom"
                  ? "border-primary"
                  : "border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-accent/50"
              )}
              onClick={() => setSelectedPresetId("custom")}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                  selectedPresetId === "custom"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  <Wand2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base mb-1">Build your own</h3>
                  <p className="text-sm text-muted-foreground">
                    Create a custom assistant with your own name, instructions, and personality.
                  </p>
                </div>
                {selectedPresetId === "custom" && (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>

              {/* Custom Form */}
              {selectedPresetId === "custom" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-6 pt-6 border-t space-y-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Name
                    </Label>
                    <Input
                      id="name"
                      placeholder="e.g. My Personal Assistant"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="h-11"
                    />
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Assistant Image</Label>
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 rounded-xl bg-muted border-2 border-dashed border-border overflow-hidden group cursor-pointer">
                        {imagePreviewUrl ? (
                          <img
                            src={imagePreviewUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Upload className="w-5 h-5 text-white" />
                        </div>
                        <input
                          type="file"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={handleImageChange}
                          accept="image/*"
                        />
                      </div>
                      <div className="flex-1 text-sm text-muted-foreground">
                        <p>Upload an image for your assistant</p>
                        <p className="text-xs mt-1">JPG or PNG, max 5MB</p>
                      </div>
                    </div>
                  </div>

                  {/* Prompt */}
                  <div className="space-y-2">
                    <Label htmlFor="prompt" className="text-sm font-medium">
                      Prompt for AI Soul Generation
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Describe the purpose and personality of your assistant. AI will generate a complete instruction set based on this.
                    </p>
                    <Textarea
                      id="prompt"
                      placeholder="e.g. A fitness coach who helps me track workouts and stay motivated..."
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      rows={5}
                      className="resize-none"
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Create Button */}
          {selectedPresetId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-end gap-3"
            >
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Assistant
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
