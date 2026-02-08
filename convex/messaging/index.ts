// Messaging Module - Telegram & WhatsApp Integrations

export * from "./types";
export * from "./channels";

// Re-export webhook handlers for http.ts (non-Node.js)
export { telegramWebhook } from "./telegram";
export { whatsAppWebhook, whatsAppVerify } from "./whatsapp";

// Re-export DB operations (non-Node.js)
export * from "./telegramDb";
export * from "./whatsappDb";

// Note: telegramActions and whatsappActions are Node.js files
// and must be imported via internal API, not re-exported here
