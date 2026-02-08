import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import QRCode from "react-qr-code";

interface MessagingConnectionDialogProps {
    projectId: Id<"projects">;
    platform: "telegram" | "whatsapp";
    isOpen: boolean;
    onClose: () => void;
}

export function MessagingConnectionDialog({
    projectId,
    platform,
    isOpen,
    onClose,
}: MessagingConnectionDialogProps) {
    const updateProject = useMutation(apiAny.projects.updateProject);
    const messagingConfig = useQuery(
        apiAny.messaging.pairingTokens.getMessagingConfig,
        isOpen ? { projectId } : "skip"
    );

    const botUsername = messagingConfig?.telegramBotUsername || "";
    const whatsappNumber = messagingConfig?.whatsappNumber || "";

    const [botUsernameInput, setBotUsernameInput] = useState("");
    const [botTokenInput, setBotTokenInput] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [savedUsername, setSavedUsername] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        setBotUsernameInput(botUsername);
        setBotTokenInput("");
        setSavedUsername("");
    }, [isOpen, botUsername]);

    const effectiveBotUsername = botUsername || savedUsername;
    const isConfigured = platform === "telegram"
        ? !!effectiveBotUsername
        : !!whatsappNumber;

    // Use projectId in deep link (not token - approval flow)
    const deepLink = isConfigured
        ? platform === "telegram"
            ? `https://t.me/${effectiveBotUsername}?start=${projectId}`
            : `https://wa.me/${whatsappNumber}?text=connect%20${projectId}`
        : "";

    const tgDeepLink = isConfigured && platform === "telegram"
        ? `tg://resolve?domain=${effectiveBotUsername}&start=${projectId}`
        : "";

    const handleOpenTelegram = () => {
        if (!deepLink) return;

        // On mobile, prefer the native Telegram scheme; fallback to https.
        if (tgDeepLink) {
            window.location.href = tgDeepLink;
            // If the scheme is blocked, user will stay and can use the https button below.
            return;
        }

        window.open(deepLink, "_blank");
    };

    const handleShare = async () => {
        try {
            if (!deepLink) return;
            if (navigator?.share) {
                await navigator.share({ title: "Connect Telegram", text: "Connect this project in Telegram", url: deepLink });
            } else {
                await handleCopy();
            }
        } catch {
            // ignore
        }
    };

    const handleCopy = async () => {
        try {
            if (typeof window === "undefined" || !deepLink) return;
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(deepLink);
                toast.success("Link copied to clipboard");
                return;
            }

            // Fallback for browsers that don't support Clipboard API (e.g. some iOS Safari contexts)
            const el = document.createElement("textarea");
            el.value = deepLink;
            el.setAttribute("readonly", "");
            el.style.position = "absolute";
            el.style.left = "-9999px";
            document.body.appendChild(el);
            el.select();
            const ok = document.execCommand("copy");
            document.body.removeChild(el);

            if (ok) {
                toast.success("Link copied to clipboard");
            } else {
                toast.error("Copy not supported. Tap and hold the link to copy.");
            }
        } catch {
            toast.error("Copy not supported. Tap and hold the link to copy.");
        }
    };

    const handleSaveTelegram = async () => {
        const token = botTokenInput.trim();
        const usernameRaw = botUsernameInput.trim();
        const username = usernameRaw.replace(/^@/, "");

        if (!username) {
            toast.error("Please enter your Telegram bot username");
            return;
        }
        if (!token) {
            toast.error("Please enter your Telegram bot token");
            return;
        }

        try {
            setIsSaving(true);
            await updateProject({
                projectId,
                telegramBotUsername: username,
                telegramBotToken: token,
            });
            setSavedUsername(username);
            setBotTokenInput("");
            toast.success("Telegram bot saved. Continue to connect.");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save Telegram bot");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        Connect {platform === "telegram" ? "Telegram" : "WhatsApp"}
                    </DialogTitle>
                    <DialogDescription>
                        Follow the instructions below to connect your messaging app to this project.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {!isConfigured ? (
                        <div className="flex flex-col gap-4 py-4">
                            <div className="p-4 border border-yellow-500/50 rounded-lg bg-yellow-500/10">
                                <p className="text-sm font-medium mb-2">
                                    {platform === "telegram"
                                        ? "Telegram Bot Not Configured"
                                        : "WhatsApp Number Not Configured"}
                                </p>
                                <p className="text-sm text-muted-foreground mb-3">
                                    {platform === "telegram"
                                        ? "To connect Telegram, you need to create your own bot first. This bot will act as your project's assistant."
                                        : "To connect WhatsApp, you need to configure your WhatsApp Business number."}
                                </p>
                                {platform === "telegram" && (
                                    <>
                                        <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1 mb-3">
                                            <li>Open Telegram and search for @BotFather</li>
                                            <li>Send /newbot command</li>
                                            <li>Follow instructions to create your bot</li>
                                            <li>Copy the bot username (e.g., "myassistant_bot")</li>
                                            <li>Copy the bot token and enter it below</li>
                                        </ol>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.open("https://t.me/botfather", "_blank")}
                                        >
                                            Open @BotFather
                                        </Button>
                                    </>
                                )}
                            </div>

                            {platform === "telegram" && (
                                <div className="grid gap-4 rounded-lg border p-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="telegram-username">Bot username</Label>
                                        <Input
                                            id="telegram-username"
                                            placeholder="myassistant_bot"
                                            value={botUsernameInput}
                                            onChange={(e) => setBotUsernameInput(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="telegram-token">Bot token</Label>
                                        <Input
                                            id="telegram-token"
                                            type="password"
                                            placeholder="123456:ABC..."
                                            value={botTokenInput}
                                            onChange={(e) => setBotTokenInput(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Your token is saved securely and never shown back in the UI.
                                        </p>
                                    </div>
                                    <Button onClick={handleSaveTelegram} disabled={isSaving}>
                                        {isSaving ? "Saving..." : "Save & Continue"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Deep Link */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Connection Link:</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={deepLink}
                                        readOnly
                                        className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleCopy}
                                        aria-label="Copy link"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="flex gap-2">
                                    {platform === "telegram" && (
                                        <Button onClick={handleOpenTelegram} className="flex-1">
                                            Open Telegram
                                        </Button>
                                    )}
                                    <Button variant="outline" onClick={handleShare} className="flex-1">
                                        Share
                                    </Button>
                                </div>

                                {platform === "telegram" && tgDeepLink && (
                                    <p className="text-xs text-muted-foreground">
                                        Tip: If the button doesn’t open the app, use the QR code or tap-and-hold the link to copy.
                                    </p>
                                )}
                            </div>

                            {/* QR Code */}
                            <div className="flex flex-col items-center gap-2 py-4">
                                <div className="p-4 bg-white rounded-lg border">
                                    <QRCode value={deepLink} size={200} />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Scan with your mobile device
                                </p>
                            </div>

                            {/* Instructions */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Instructions:</label>
                                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                                    {platform === "telegram" ? (
                                        <>
                                            <li>Click the link above or scan the QR code</li>
                                            <li>Press "Start" in Telegram</li>
                                            <li>You'll receive a pairing code</li>
                                            <li>Return here to approve the connection</li>
                                        </>
                                    ) : (
                                        <>
                                            <li>Click the link above or scan the QR code</li>
                                            <li>Send the message to WhatsApp</li>
                                            <li>You'll receive a pairing code</li>
                                            <li>Return here to approve the connection</li>
                                        </>
                                    )}
                                </ol>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex justify-end">
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
