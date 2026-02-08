"use server";

import type { WebhookEvent } from "@clerk/clerk-sdk-node";
import { httpAction } from "./_generated/server";
import { Webhook } from "svix";
const internalAny = require("./_generated/api").internal as any;

const handleClerkWebhook = httpAction(async (ctx, request) => {
  const event = await validateRequest(request);
  if (!event) {
    return new Response("Could not validate request", {
      status: 400,
    });
  }
  switch (event.type) {
    case "user.created":
        await ctx.runMutation(internalAny.myFunctions.createOrUpdateUser, {
            clerkUserId: event.data.id,
            email: event.data.email_addresses[0].email_address,
            name: event.data.first_name + " " + event.data.last_name,
            imageUrl: event.data.image_url,
        });
        break;
    case "user.updated":
        await ctx.runMutation(internalAny.myFunctions.createOrUpdateUser, {
            clerkUserId: event.data.id,
            email: event.data.email_addresses[0].email_address,
            name: event.data.first_name + " " + event.data.last_name,
            imageUrl: event.data.image_url,
        });
        break;
    case "user.deleted":
      if (event.data.id) {
        await ctx.runMutation(internalAny.myFunctions.deleteUser, {
          clerkUserId: event.data.id,
        });
      }
      break;
    default: {
      console.log("Ignored Clerk webhook event:", event.type);
    }
  }
  return new Response(null, {
    status: 200,
  });
});

async function validateRequest(
  req: Request
): Promise<WebhookEvent | undefined> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("CLERK_WEBHOOK_SECRET is not set");
  }
  const payloadString = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  };
  const wh = new Webhook(webhookSecret);
  try {
    return wh.verify(payloadString, svixHeaders) as WebhookEvent;
  } catch (error) {
    console.error("Error verifying webhook:", error);
    return;
  }
}

export default handleClerkWebhook; 
