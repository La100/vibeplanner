"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadCloud, Trash2, MessageCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/components/providers/ProjectProvider";
import { MessagingConnectionDialog } from "./MessagingConnectionDialog";
import { ConnectedChannelsList } from "./ConnectedChannelsList";
import { useRouter, useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { resolveAssistantImageUrl } from "@/lib/assistantImage";

export default function AssistantSettingsPage() {
  const { project } = useProject();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState(project?.name || "");
  const [telegramBotUsername, setTelegramBotUsername] = useState(project?.telegramBotUsername || "");
  const [telegramBotToken, setTelegramBotToken] = useState(project?.telegramBotToken || "");
  const [whatsappNumber, setWhatsappNumber] = useState(project?.whatsappNumber || "");
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<"telegram" | "whatsapp" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSyncRef = useRef(false);
  const savedModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateProject = useMutation(apiAny.projects.updateProject);
  const deleteProject = useMutation(apiAny.projects.deleteProject);
  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);
  const setProjectImageFromFileKey = useMutation(apiAny.projects.setProjectImageFromFileKey);
  const connectedChannels = useQuery(
    apiAny.messaging.pairingTokens.getConnectedChannels,
    project?._id ? { projectId: project._id } : "skip"
  );
  const pendingRequests = useQuery(
    apiAny.messaging.pairingRequests.listPendingRequests,
    project?._id ? { projectId: project._id } : "skip"
  );
  const approveRequest = useMutation(apiAny.messaging.pairingRequests.approvePairingRequest);
  const rejectRequest = useMutation(apiAny.messaging.pairingRequests.rejectPairingRequest);

  useEffect(() => {
    if (!project) return;
    initialSyncRef.current = false;
    setName(project.name || "");
    setTelegramBotUsername(project.telegramBotUsername || "");
    setTelegramBotToken(project.telegramBotToken || "");
    setWhatsappNumber(project.whatsappNumber || "");
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      if (savedModalTimerRef.current) {
        clearTimeout(savedModalTimerRef.current);
      }
    };
  }, []);

  const resolvedAssistantImageUrl = useMemo(
    () =>
      resolveAssistantImageUrl({
        imageUrl: project?.imageUrl,
        assistantPreset: project?.assistantPreset,
      }),
    [project?.assistantPreset, project?.imageUrl],
  );

  const showSavedConfirmation = () => {
    if (savedModalTimerRef.current) {
      clearTimeout(savedModalTimerRef.current);
    }
    setShowSavedModal(true);
    savedModalTimerRef.current = setTimeout(() => {
      setShowSavedModal(false);
    }, 1200);
  };

  const saveSettings = useCallback(async () => {
    if (!project?._id) return;
    if (!name.trim()) return;

    try {
      setIsSaving(true);
      await updateProject({
        projectId: project._id,
        name: name.trim(),
        telegramBotUsername: telegramBotUsername.trim() || undefined,
        telegramBotToken: telegramBotToken.trim() || undefined,
        whatsappNumber: whatsappNumber.trim() || undefined,
      });
      showSavedConfirmation();
    } catch (error) {
      toast.error("Failed to save settings");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    project?._id,
    telegramBotToken,
    telegramBotUsername,
    updateProject,
    whatsappNumber,
  ]);

  const uploadImage = useCallback(async (file: File) => {
    if (!project?._id) return;

    try {
      setIsSaving(true);
      const uploadData = await generateUploadUrl({
        projectId: project._id,
        fileName: file.name,
        origin: "general",
        fileSize: file.size,
      });

      const uploadResult = await fetch(uploadData.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error("Image upload failed");
      }

      await addFile({
        projectId: project._id,
        fileKey: uploadData.key,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        origin: "general",
      });

      await setProjectImageFromFileKey({
        projectId: project._id,
        fileKey: uploadData.key,
      });

      showSavedConfirmation();
    } catch (uploadError) {
      console.error(uploadError);
      toast.error("Image upload failed");
    } finally {
      setIsSaving(false);
    }
  }, [
    addFile,
    generateUploadUrl,
    project?._id,
    setProjectImageFromFileKey,
  ]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error("Image is too large (max 5MB)");
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImagePreviewUrl(URL.createObjectURL(file));
    await uploadImage(file);
  };

  useEffect(() => {
    if (!project?._id) return;
    if (!initialSyncRef.current) {
      initialSyncRef.current = true;
      return;
    }
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      saveSettings();
    }, 700);
  }, [
    name,
    telegramBotUsername,
    telegramBotToken,
    whatsappNumber,
    project?._id,
    saveSettings,
  ]);

  const handleConnectPlatform = (platform: "telegram" | "whatsapp") => {
    setSelectedPlatform(platform);
    setConnectionDialogOpen(true);
  };

  const handleApprove = async (requestId: string) => {
    try {
      await approveRequest({ requestId: requestId as Id<"messagingPairingRequests"> });
      toast.success("Connection approved");
    } catch (error) {
      toast.error("Failed to approve connection");
      console.error(error);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await rejectRequest({ requestId: requestId as Id<"messagingPairingRequests"> });
      toast.success("Connection rejected");
    } catch (error) {
      toast.error("Failed to reject connection");
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!project?._id) return;
    try {
      setIsDeleting(true);
      await deleteProject({ projectId: project._id });
      setDeleteDialogOpen(false);
      toast.success("Assistant deleted");
      router.push("/organisation");
    } catch (error) {
      toast.error("Failed to delete assistant");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const tabParam = searchParams?.get("tab");
  const [activeTab, setActiveTab] = useState<"basic" | "messaging">(
    tabParam === "messaging" ? "messaging" : "basic"
  );

  useEffect(() => {
    if (tabParam === "messaging") {
      setActiveTab("messaging");
    } else if (tabParam === "basic") {
      setActiveTab("basic");
    }
  }, [tabParam]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assistant Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your assistant profile, messaging connections, and behavior.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "basic" | "messaging")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-9">
          <TabsTrigger value="basic" className="text-xs sm:text-sm">
            Basic Settings
          </TabsTrigger>
          <TabsTrigger value="messaging" className="text-xs sm:text-sm">
            Messaging
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6">
          <div className="grid gap-6">
            <div className="flex flex-col gap-4">
              <label className="text-sm font-medium">Assistant Profile</label>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="assistant-name">Name</Label>
                  <Input
                    id="assistant-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Assistant name"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Assistant Image</Label>
                <div className="flex items-start gap-4">
                  <div className="h-24 w-24 overflow-hidden rounded-full border border-border/60 bg-muted/40">
                    {imagePreviewUrl ? (
                      <img
                        src={imagePreviewUrl}
                        alt="Selected assistant"
                        className="h-full w-full object-cover"
                      />
                    ) : resolvedAssistantImageUrl ? (
                      <img
                        src={resolvedAssistantImageUrl}
                        alt={project.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <label className="flex cursor-pointer items-center gap-2">
                        <UploadCloud className="h-4 w-4" />
                        <span>Upload image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    </Button>
                    {imagePreviewUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (imagePreviewUrl) {
                            URL.revokeObjectURL(imagePreviewUrl);
                          }
                          setImagePreviewUrl(null);
                        }}
                      >
                        Remove selection
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">PNG or JPG up to 5MB.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </TabsContent>

        <TabsContent value="messaging" className="mt-6">
          <div className="grid gap-6">
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium">Messaging Connections</label>
              <p className="text-xs text-muted-foreground">
                Connect messaging apps to receive notifications and interact with your assistant.
              </p>

              <div className="grid gap-4">
                <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">Telegram</p>
                      <p className="text-xs text-muted-foreground">
                        Your bot becomes the assistant. Create it once, then connect it to this project.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnectPlatform("telegram")}
                      className="flex items-center gap-2"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Connect Telegram
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-3">
                      <p className="text-xs font-medium mb-2">Telegram setup in plain steps</p>
                      <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                        <li>Open Telegram and search for @BotFather</li>
                        <li>Send <code className="bg-muted px-1 rounded">/newbot</code> and finish the setup</li>
                        <li>Copy the bot <strong>username</strong> and <strong>token</strong></li>
                        <li>Paste them below and changes will autosave</li>
                        <li>Click “Connect Telegram”, press Start, then approve the pairing code here</li>
                      </ol>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <label htmlFor="telegram-bot" className="text-xs font-medium">
                          Bot Username
                        </label>
                        <input
                          id="telegram-bot"
                          name="telegram-bot-username"
                          type="text"
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          inputMode="text"
                          value={telegramBotUsername}
                          onChange={(e) => setTelegramBotUsername(e.target.value)}
                          placeholder="myassistant_bot (without @)"
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <p className="text-xs text-muted-foreground">
                          Example: <span className="font-medium">myassistant_bot</span> (not your email).
                        </p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label htmlFor="telegram-token" className="text-xs font-medium">
                          Bot Token
                        </label>
                        <input
                          id="telegram-token"
                          name="telegram-bot-token"
                          type="password"
                          autoComplete="new-password"
                          value={telegramBotToken}
                          onChange={(e) => setTelegramBotToken(e.target.value)}
                          placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <p className="text-xs text-muted-foreground">
                          Keep it private. You can regenerate it anytime in @BotFather.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">WhatsApp</p>
                      <p className="text-xs text-muted-foreground">
                        Connect your WhatsApp Business number to this project.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnectPlatform("whatsapp")}
                      className="flex items-center gap-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Connect WhatsApp
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <label htmlFor="whatsapp-number" className="text-xs font-medium">
                      WhatsApp Business Number
                    </label>
                    <input
                      id="whatsapp-number"
                      name="whatsapp-number"
                      type="text"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="+1234567890"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {project?._id && (
                <ConnectedChannelsList
                  projectId={project._id}
                  channels={connectedChannels || []}
                />
              )}

              {pendingRequests && pendingRequests.length > 0 && (
                <div className="mt-4 p-3 border border-yellow-500/50 rounded-lg bg-yellow-500/10">
                  <p className="text-sm font-medium mb-3">
                    Pending Connection Requests ({pendingRequests.length})
                  </p>
                  <div className="flex flex-col gap-2">
                    {pendingRequests.map((request) => (
                      <div
                        key={request._id}
                        className="flex items-center justify-between p-2 bg-background rounded border"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {request.platform === "telegram" ? "Telegram" : "WhatsApp"}:{" "}
                            {request.metadata?.username
                              ? `@${request.metadata.username}`
                              : request.externalUserId}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Code: {request.pairingCode}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request._id)}
                            className="h-8"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(request._id)}
                            className="h-8"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="gap-2"
                disabled={isSaving || isDeleting}
              >
                <Trash2 className="h-4 w-4" />
                Delete Assistant
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete assistant?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action is permanent. It will remove this assistant and all related tasks, files, and chats.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    void handleDelete();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <p className="text-xs text-muted-foreground">
          Deleting an assistant removes its tasks, files, and chats permanently.
        </p>
      </div>

      <Dialog open={showSavedModal} onOpenChange={setShowSavedModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Saved</DialogTitle>
            <DialogDescription>Your changes were saved automatically.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {selectedPlatform && project?._id && (
        <MessagingConnectionDialog
          projectId={project._id}
          platform={selectedPlatform}
          isOpen={connectionDialogOpen}
          onClose={() => {
            setConnectionDialogOpen(false);
            setSelectedPlatform(null);
          }}
        />
      )}
    </div>
  );
}
