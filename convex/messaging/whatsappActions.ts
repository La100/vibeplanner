"use node";

/**
 * WhatsApp Node.js Actions
 * 
 * Node.js-specific actions for WhatsApp integration.
 * These handle the actual message processing and API calls.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
const internalAny = require("../_generated/api").internal as any;

const WHATSAPP_API_BASE = "https://graph.facebook.com/v18.0";

// Handle incoming WhatsApp message
export const handleWhatsAppMessage = internalAction({
    args: {
        phoneNumber: v.string(),
        text: v.string(),
        messageId: v.string(),
        timestamp: v.number(),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        console.log("🔄 [WHATSAPP MESSAGE]", {
            phoneNumber: args.phoneNumber,
            textPreview: args.text.substring(0, 50),
        });

        // Handle connect command
        if (args.text.toLowerCase().startsWith("connect ")) {
            const projectIdStr = args.text.replace(/^connect\s+/i, "").trim();
            await processConnectCommand(ctx, args.phoneNumber, projectIdStr, args.metadata);
            return;
        }

        // Regular message - process via AI
        await processRegularMessage(ctx, args.phoneNumber, args.text);
    },
});

// Process connect command
async function processConnectCommand(
    ctx: any,
    phoneNumber: string,
    projectIdStr: string,
    metadata?: any
): Promise<void> {
    try {
        const project = await ctx.runQuery(internalAny.projects.getProjectByIdInternal, {
            projectId: projectIdStr as any,
        });

        if (!project) {
            await sendWhatsAppMessageDirect(phoneNumber, "❌ Nie znaleziono projektu o podanym ID.");
            return;
        }

        const channel = await ctx.runMutation(internalAny.messaging.channels.getOrCreateChannel, {
            platform: "whatsapp" as const,
            externalUserId: phoneNumber,
            projectId: projectIdStr as any,
            metadata,
        });

        const message = channel.isNew
            ? `✅ Połączono z projektem "${project.name}"! Możesz teraz pisać do mnie wiadomości.`
            : `✅ Już jesteś połączony z projektem "${project.name}".`;

        await sendWhatsAppMessageDirect(phoneNumber, message);
    } catch (error) {
        console.error("❌ [WHATSAPP CONNECT ERROR]", error);
        await sendWhatsAppMessageDirect(phoneNumber, "❌ Wystąpił błąd podczas łączenia z projektem.");
    }
}

// Process regular message via AI
async function processRegularMessage(
    ctx: any,
    phoneNumber: string,
    text: string
): Promise<void> {
    // Find the channel for this phone number
    const channel = await ctx.runQuery(internalAny.messaging.channels.getChannelByExternalId, {
        platform: "whatsapp",
        externalUserId: phoneNumber,
    });

    if (!channel) {
        await sendWhatsAppMessageDirect(
            phoneNumber,
            "⚠️ Nie jesteś połączony z żadnym projektem. Wyślij 'connect <project_id>' aby się połączyć."
        );
        return;
    }

    try {
        // Generate thread ID if not exists
        let threadId = channel.threadId;
        if (!threadId) {
            threadId = `whatsapp-${phoneNumber}-${Date.now()}`;
            await ctx.runMutation(internalAny.messaging.channels.updateChannelThreadId, {
                channelId: channel._id,
                threadId,
            });
        }

        // Ensure thread exists
        await ctx.runMutation(internalAny.messaging.whatsappDb.insertAiThread, {
            threadId,
            projectId: channel.projectId,
            teamId: channel.teamId,
            userClerkId: `whatsapp:${phoneNumber}`,
        });

        // Call AI streaming
        await ctx.runAction(internalAny.ai.streaming.internalDoStreaming, {
            message: text,
            projectId: channel.projectId,
            userClerkId: `whatsapp:${phoneNumber}`,
            threadId,
        });

        // Get the AI response
        const response = await ctx.runQuery(internalAny.messaging.telegramDb.getLatestAssistantMessage, {
            threadId,
        });

        if (response) {
            await sendWhatsAppMessageDirect(phoneNumber, response);
        } else {
            await sendWhatsAppMessageDirect(phoneNumber, "🤔 Przepraszam, nie udało mi się wygenerować odpowiedzi.");
        }
    } catch (error) {
        console.error("❌ [WHATSAPP AI ERROR]", error);
        await sendWhatsAppMessageDirect(
            phoneNumber,
            "❌ Wystąpił błąd podczas przetwarzania wiadomości. Spróbuj ponownie."
        );
    }
}

// Helper: Send message via WhatsApp Cloud API
async function sendWhatsAppMessageDirect(to: string, text: string): Promise<void> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
        console.error("❌ WhatsApp credentials not configured");
        return;
    }

    try {
        const response = await fetch(
            `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: to,
                    type: "text",
                    text: { body: text },
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error("❌ [WHATSAPP SEND ERROR]", error);
        }
    } catch (error) {
        console.error("❌ [WHATSAPP SEND ERROR]", error);
    }
}
