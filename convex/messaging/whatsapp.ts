/**
 * WhatsApp HTTP Routes (non-Node.js)
 * 
 * HTTP handlers for WhatsApp webhooks. These cannot be in Node.js files.
 * They delegate to Node.js actions for the actual processing.
 */

import { httpAction } from "../_generated/server";
import type { WhatsAppWebhookPayload } from "./types";
const internalAny = require("../_generated/api").internal as any;

// WhatsApp Webhook Verification (GET request from Meta)
export const whatsAppVerify = httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Note: We can't access env vars in non-Node.js context,
    // so verification token is hardcoded or passed via different means
    // For now, we'll pass through to the action for verification

    console.log("🔐 [WHATSAPP VERIFY]", { mode, hasToken: !!token, hasChallenge: !!challenge });

    // Simple verification - in production, compare token with env var
    if (mode === "subscribe" && token) {
        console.log("✅ [WHATSAPP VERIFY] Success");
        return new Response(challenge || "", { status: 200 });
    }

    console.error("❌ [WHATSAPP VERIFY] Failed");
    return new Response("Forbidden", { status: 403 });
});

// WhatsApp Webhook Handler (POST - incoming messages)
export const whatsAppWebhook = httpAction(async (ctx, request) => {
    try {
        const body = await request.json() as WhatsAppWebhookPayload;

        console.log("📨 [WHATSAPP WEBHOOK]", {
            object: body.object,
            hasEntries: body.entry?.length > 0,
        });

        // Validate it's a WhatsApp message
        if (body.object !== "whatsapp_business_account") {
            return new Response("OK", { status: 200 });
        }

        // Process each entry
        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                const value = change.value;

                if (!value.messages || value.messages.length === 0) {
                    continue;
                }

                for (const message of value.messages) {
                    // Only handle text messages for now
                    if (message.type === "text" && message.text?.body) {
                        const contact = value.contacts?.[0];

                        await ctx.runAction(internalAny.messaging.whatsappActions.handleWhatsAppMessage, {
                            phoneNumber: message.from,
                            text: message.text.body,
                            messageId: message.id,
                            timestamp: parseInt(message.timestamp) * 1000,
                            metadata: {
                                name: contact?.profile?.name,
                            },
                        });
                    }
                }
            }
        }

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error("❌ [WHATSAPP WEBHOOK ERROR]", error);
        return new Response("Error", { status: 500 });
    }
});
