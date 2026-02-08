import { MessageCircle, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

interface Channel {
    platform: "telegram" | "whatsapp";
    externalUserId: string;
    lastMessageAt?: number;
    metadata?: unknown;
}

interface ConnectedChannelsListProps {
    projectId: Id<"projects">;
    channels: Channel[];
}

export function ConnectedChannelsList({ projectId, channels }: ConnectedChannelsListProps) {
    const disconnectChannel = useMutation(apiAny.messaging.channels.disconnectChannel);

    const handleDisconnect = async (platform: string, externalUserId: string) => {
        try {
            await disconnectChannel({ projectId, platform, externalUserId });
            toast.success("Channel disconnected");
        } catch (error) {
            toast.error("Failed to disconnect channel");
            console.error(error);
        }
    };

    if (!channels || channels.length === 0) {
        return (
            <div className="text-xs text-muted-foreground py-2">
                No connected channels yet
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 mt-2">
            <div className="text-xs font-medium text-muted-foreground">
                Connected Channels:
            </div>
            {channels.map((channel, idx) => (
                <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-md border bg-muted/50"
                >
                    <div className="flex items-center gap-2">
                        {channel.platform === "telegram" ? (
                            <MessageCircle className="h-4 w-4 text-blue-500" />
                        ) : (
                            <MessageSquare className="h-4 w-4 text-green-500" />
                        )}
                        <div className="flex flex-col">
                            <span className="text-sm font-medium capitalize">
                                {channel.platform}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {channel.externalUserId}
                            </span>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            handleDisconnect(channel.platform, channel.externalUserId)
                        }
                        className="h-8 w-8 p-0"
                    >
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            ))}
        </div>
    );
}
