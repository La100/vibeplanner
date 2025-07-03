"use server";

import type { WebhookEvent } from "@clerk/clerk-sdk-node";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { Webhook } from "svix";

const handleClerkWebhook = httpAction(async (ctx, request) => {
  const event = await validateRequest(request);
  if (!event) {
    return new Response("Could not validate request", {
      status: 400,
    });
  }
  switch (event.type) {
    case "organization.created":
      await ctx.runMutation(internal.myFunctions.createOrUpdateTeam, {
        clerkOrgId: event.data.id,
        name: event.data.name,
        slug: event.data.slug!,
        imageUrl: event.data.image_url,
      });
      break;
    case "organization.updated":
      await ctx.runMutation(internal.myFunctions.createOrUpdateTeam, {
        clerkOrgId: event.data.id,
        name: event.data.name,
        slug: event.data.slug!,
        imageUrl: event.data.image_url,
      });
      break;
    case "organization.deleted":
      if (event.data.id) {
        await ctx.runMutation(internal.myFunctions.deleteTeam, {
          clerkOrgId: event.data.id,
        });
      }
      break;
    case "organizationMembership.created":
        await ctx.runMutation(internal.myFunctions.createOrUpdateMembership, {
            clerkOrgId: event.data.organization.id,
            clerkUserId: event.data.public_user_data.user_id,
            role: event.data.role,
            orgName: event.data.organization.name,
            orgSlug: event.data.organization.slug!,
            orgImageUrl: event.data.organization.image_url,
            userEmail: (event.data.public_user_data as any).email_addresses?.[0]?.email_address || 
                      (event.data.public_user_data as any).email_address,
        });
        break;
    case "organizationMembership.updated":
        await ctx.runMutation(internal.myFunctions.createOrUpdateMembership, {
            clerkOrgId: event.data.organization.id,
            clerkUserId: event.data.public_user_data.user_id,
            role: event.data.role,
            orgName: event.data.organization.name,
            orgSlug: event.data.organization.slug!,
            orgImageUrl: event.data.organization.image_url,
            userEmail: (event.data.public_user_data as any).email_addresses?.[0]?.email_address || 
                      (event.data.public_user_data as any).email_address,
        });
        break;
    case "organizationMembership.deleted":
        await ctx.runMutation(internal.myFunctions.deleteMembership, {
            clerkOrgId: event.data.organization.id,
            clerkUserId: event.data.public_user_data.user_id,
        });
        break;
    case "user.created":
        await ctx.runMutation(internal.myFunctions.createOrUpdateUser, {
            clerkUserId: event.data.id,
            email: event.data.email_addresses[0].email_address,
            name: event.data.first_name + " " + event.data.last_name,
        });
        break;
    case "user.updated":
        await ctx.runMutation(internal.myFunctions.createOrUpdateUser, {
            clerkUserId: event.data.id,
            email: event.data.email_addresses[0].email_address,
            name: event.data.first_name + " " + event.data.last_name,
        });
        break;
    case "user.deleted":
      if (event.data.id) {
        await ctx.runMutation(internal.myFunctions.deleteUser, {
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