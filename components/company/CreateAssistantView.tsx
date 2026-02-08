"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, User, Check, Wand2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useMotionTemplate, useMotionValue } from "framer-motion";
import { ASSISTANT_PRESETS, getPreset, type AssistantPreset } from "@/convex/ai/presets";

function SpotlightCard({
    children,
    className,
    onClick,
}: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}) {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
        const { left, top } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - left);
        mouseY.set(clientY - top);
    }

    return (
        <motion.div
            className={cn(
                "group relative border bg-card overflow-hidden cursor-pointer",
                className
            )}
            onMouseMove={handleMouseMove}
            onClick={onClick}
            layout
        >
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
                style={{
                    background: useMotionTemplate`
                        radial-gradient(
                            650px circle at ${mouseX}px ${mouseY}px,
                            rgba(255,255,255,0.15),
                            transparent 80%
                        )
                    `,
                }}
            />
            {children}
        </motion.div>
    );
}

// presetVisuals removed - now using properties from ASSISTANT_PRESETS

const staggerContainer = {
    hidden: {},
    show: {
        transition: {
            staggerChildren: 0.06,
            delayChildren: 0.1,
        },
    },
} as const;

const staggerItem = {
    hidden: { opacity: 0, y: 24, scale: 0.95 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 400, damping: 28 },
    },
} as const;

function PresetCard({
    preset,
    isSelected,
    onSelect,
}: {
    preset: AssistantPreset;
    isSelected: boolean;
    onSelect: (id: string) => void;
}) {
    return (
        <motion.div variants={staggerItem}>
            <SpotlightCard
                onClick={() => onSelect(preset.id)}
                className={cn(
                    "aspect-[3/4] rounded-3xl transition-all duration-500",
                    isSelected
                        ? "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background scale-[1.02] shadow-2xl z-10"
                        : "hover:scale-[1.01] hover:shadow-xl border-transparent bg-card/40 backdrop-blur-sm"
                )}
            >
                <div
                    className={cn("absolute top-0 left-0 right-0 -bottom-10 bg-cover bg-center", !preset.image && preset.backgroundClass)}
                >
                    {preset.image ? (
                        <img
                            src={preset.image}
                            alt={preset.name}
                            className={cn(
                                "w-full h-full object-cover",
                                (preset.id === "marcus" || preset.id === "gymbro") && "object-top"
                            )}
                        />
                    ) : (
                        <div className={cn("w-full h-full bg-gradient-to-br", preset.gradient)} />
                    )}
                </div>
                <div className="absolute inset-x-0 top-0 p-5 text-white transform transition-transform duration-500 -translate-y-2 group-hover:translate-y-0 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                    <h4 className="font-bold text-lg mb-1">{preset.name}</h4>
                    <p className="text-sm text-white/80 line-clamp-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100 font-medium">
                        {preset.description}
                    </p>
                </div>
                {isSelected && (
                    <>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent h-20" />
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute bottom-5 left-5 inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-white bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/20"
                        >
                            <Check className="w-3 h-3" /> SELECTED
                        </motion.div>
                    </>
                )}
            </SpotlightCard>
        </motion.div>
    );
}

interface CreateAssistantViewProps {
    teamId: Id<"teams">;
    onCancel: () => void;
}

export function CreateAssistantView(props: CreateAssistantViewProps) {
    const { teamId } = props;
    const router = useRouter();
    const createProject = useMutation(apiAny.projects.createProjectInOrg);
    const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
    const addFile = useMutation(apiAny.files.addFile);
    const setProjectImageFromFileKey = useMutation(apiAny.projects.setProjectImageFromFileKey);

    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState(() => {
        const defaultPreset = getPreset("marcus");
        return {
            name: defaultPreset?.name || "Marcus Aurelius",
            customAiPrompt: "",
            assistantPreset: "marcus",
            useOnboarding: true,
        };
    });

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
        };
    }, [imagePreviewUrl]);

    const handlePresetSelect = (presetId: string) => {
        setFormData((prev) => {
            const nextPreset = getPreset(presetId);
            let nextName = prev.name;
            if (presetId === "custom") {
                const wasPresetName = ASSISTANT_PRESETS.some((p) => p.name === prev.name);
                if (wasPresetName) nextName = "";
            } else {
                nextName = nextPreset?.name || "";
            }
            return {
                ...prev,
                assistantPreset: presetId,
                name: nextName,
                customAiPrompt: presetId === "custom" ? prev.customAiPrompt : "",
                useOnboarding: presetId === "custom" ? prev.useOnboarding : true,
            };
        });
    };

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

    const handleSubmit = async () => {
        if (!formData.name) {
            toast.error("Please name your assistant");
            return;
        }
        setIsLoading(true);
        try {
            const result = await createProject({
                name: formData.name,
                customAiPrompt: formData.useOnboarding ? undefined : (formData.customAiPrompt || undefined),
                assistantPreset: formData.assistantPreset !== "custom" ? formData.assistantPreset : undefined,
                assistantOnboardingEnabled: formData.assistantPreset === "custom" ? formData.useOnboarding : undefined,
                teamId,
            });
            if (imageFile && result?.id) {
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
            toast.success("Assistant created successfully");
            router.push(`/organisation/projects/${result.slug}`);
        } catch (error) {
            toast.error("Failed to create assistant");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const isCustom = formData.assistantPreset === "custom";
    const selectedPreset = !isCustom ? getPreset(formData.assistantPreset) : null;

    return (
        <div className="flex flex-col flex-1 min-h-0 -m-4 md:-m-8">
            <div className="flex-1 relative flex flex-col min-h-0">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-muted/40 via-transparent to-transparent opacity-60 pointer-events-none" />

                <div className="relative z-10 flex-1 overflow-y-auto w-full">
                    <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-10 sm:py-24">

                        {/* Top section: description + create button OR custom form */}
                        <AnimatePresence mode="wait">
                            {isCustom ? (
                                <motion.div
                                    key="custom-form"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="mb-16"
                                >
                                    <div className="rounded-2xl border border-border/60 bg-card/50 p-6 sm:p-8 space-y-6">
                                        {/* Name */}
                                        <div className="space-y-3">
                                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
                                                Name
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    placeholder="e.g. Rate My Plate"
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="h-12 pl-11 text-base bg-background/50 border-input/50 focus-visible:ring-foreground/20 focus-visible:border-foreground/30 transition-all rounded-xl shadow-sm hover:bg-background/80"
                                                    autoFocus
                                                />
                                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                                                    <Sparkles className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Config */}
                                        <div className="space-y-3">
                                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
                                                Configuration
                                            </Label>

                                            <div
                                                className={cn(
                                                    "p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm",
                                                    formData.useOnboarding
                                                        ? "bg-foreground/5 border-foreground/15 hover:border-foreground/30"
                                                        : "bg-background/40 border-border/50 hover:bg-background/60"
                                                )}
                                                onClick={() => setFormData((prev) => ({ ...prev, useOnboarding: !prev.useOnboarding }))}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0",
                                                        formData.useOnboarding ? "bg-foreground border-foreground text-background" : "border-muted-foreground/30"
                                                    )}>
                                                        {formData.useOnboarding && <Check className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-sm block mb-0.5">Interactive Interview</span>
                                                        <span className="text-xs text-muted-foreground leading-relaxed block">
                                                            The AI will ask questions to learn its purpose and build its own instructions.
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <AnimatePresence>
                                                {!formData.useOnboarding && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: "auto" }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="space-y-2 overflow-hidden"
                                                    >
                                                        <Label className="text-xs pl-1">System Instructions</Label>
                                                        <Textarea
                                                            placeholder="You are a helpful assistant..."
                                                            value={formData.customAiPrompt}
                                                            onChange={(e) => setFormData({ ...formData, customAiPrompt: e.target.value })}
                                                            className="min-h-[100px] bg-background/50 border-input/50 rounded-xl resize-none focus-visible:ring-foreground/20"
                                                        />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {/* Image upload */}
                                        <div className="flex gap-4 items-center">
                                            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-muted to-muted/50 relative border shadow-inner overflow-hidden shrink-0 flex items-center justify-center group">
                                                {imagePreviewUrl ? (
                                                    <img src={imagePreviewUrl} alt="Assistant icon preview" className="h-full w-full object-cover" />
                                                ) : (
                                                    <User className="w-6 h-6 text-muted-foreground/40 group-hover:scale-110 transition-transform" />
                                                )}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Upload className="w-3.5 h-3.5 text-white" />
                                                </div>
                                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageChange} accept="image/*" />
                                            </div>
                                            <div className="space-y-1">
                                                <Button type="button" variant="outline" size="sm" className="relative h-8 text-xs font-medium">
                                                    Upload Icon
                                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageChange} accept="image/*" />
                                                </Button>
                                                <p className="text-[10px] text-muted-foreground pl-1">JPG or PNG, max 5MB</p>
                                            </div>
                                        </div>

                                        {/* Create button */}
                                        <Button
                                            onClick={handleSubmit}
                                            disabled={isLoading || !formData.name}
                                            className="w-full h-12 text-base bg-foreground text-background hover:bg-foreground/90 shadow-lg shadow-foreground/10 transition-all font-semibold rounded-xl"
                                            size="lg"
                                        >
                                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            Create Assistant
                                        </Button>
                                    </div>
                                </motion.div>
                            ) : selectedPreset ? (
                                <motion.div
                                    key="preset-overview"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="mb-20"
                                >
                                    <div className="flex items-start justify-between gap-8">
                                        <div className="flex-1 pt-1 min-h-[3.5rem]">
                                            <motion.p
                                                key={selectedPreset.id}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.25, ease: "easeOut" }}
                                                className="text-muted-foreground text-base leading-relaxed"
                                            >
                                                {selectedPreset.description}
                                            </motion.p>
                                        </div>
                                        <Button
                                            onClick={handleSubmit}
                                            disabled={isLoading || !formData.name}
                                            size="lg"
                                            className="shrink-0 rounded-full px-10 bg-foreground text-background hover:bg-foreground/90 shadow-lg shadow-foreground/10"
                                        >
                                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            Create Assistant
                                        </Button>
                                    </div>
                                </motion.div>
                            ) : null}
                        </AnimatePresence>

                        {/* Preset grid */}
                        <motion.div
                            variants={staggerContainer}
                            initial="hidden"
                            animate="show"
                            className="grid grid-cols-2 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                        >
                            {ASSISTANT_PRESETS.filter((p) => p.id !== "custom").map((preset) => (
                                <PresetCard
                                    key={preset.id}
                                    preset={preset}
                                    isSelected={formData.assistantPreset === preset.id}
                                    onSelect={handlePresetSelect}
                                />
                            ))}
                        </motion.div>

                        {/* Custom assistant — separate from presets */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, type: "spring", stiffness: 400, damping: 28 }}
                            className="mt-8"
                        >
                            <div
                                onClick={() => handlePresetSelect("custom")}
                                className={cn(
                                    "group relative cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-8 transition-all duration-300",
                                    isCustom
                                        ? "border-foreground/40 bg-foreground/5 shadow-lg"
                                        : "border-border/60 hover:border-foreground/30 hover:bg-foreground/[0.02]"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
                                        isCustom ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                                    )}>
                                        <Wand2 className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-semibold text-base">Build your own</h4>
                                        <p className="text-sm text-muted-foreground mt-0.5">
                                            Create a custom assistant with your own name, instructions, and personality.
                                        </p>
                                    </div>
                                    {isCustom && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="ml-auto shrink-0"
                                        >
                                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background">
                                                <Check className="h-4 w-4" />
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
}
