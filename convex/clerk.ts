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
  const eventData: any = event.data;
  switch (event.type) {
    case "user.created":
        await ctx.runMutation(internalAny.myFunctions.createOrUpdateUser, {
            clerkUserId: eventData.id,
            email: eventData.email_addresses?.[0]?.email_address ?? "",
            name: [eventData.first_name, eventData.last_name].filter(Boolean).join(" ").trim(),
            imageUrl: eventData.image_url,
        });
        break;
    case "user.updated":
        await ctx.runMutation(internalAny.myFunctions.createOrUpdateUser, {
            clerkUserId: eventData.id,
            email: eventData.email_addresses?.[0]?.email_address ?? "",
            name: [eventData.first_name, eventData.last_name].filter(Boolean).join(" ").trim(),
            imageUrl: eventData.image_url,
        });
        break;
    case "user.deleted":
      if (eventData.id) {
        await ctx.runMutation(internalAny.myFunctions.deleteUser, {
          clerkUserId: eventData.id,
        });
      }
      break;
    case "organization.deleted": {
      const clerkOrgId =
        eventData.id ?? eventData.organization?.id ?? eventData.organization_id;
      if (clerkOrgId) {
        await ctx.runMutation(internalAny.myFunctions.deleteOrganization, {
          clerkOrgId,
        });
      }
      break;
    }
    case "organizationMembership.deleted": {
      const clerkOrgId =
        eventData.organization?.id ?? eventData.organization_id ?? undefined;
      const clerkUserId =
        eventData.public_user_data?.user_id ??
        eventData.publicUserData?.userId ??
        eventData.user?.id ??
        eventData.user_id ??
        undefined;

      if (clerkOrgId && clerkUserId) {
        await ctx.runMutation(internalAny.myFunctions.deleteOrganizationMembership, {
          clerkOrgId,
          clerkUserId,
        });
      }
      break;
    }
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
