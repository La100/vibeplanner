import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import handleClerkWebhook from "./clerk";

const http = httpRouter();

http.route({
  path: "/clerk",
  method: "POST",
  handler: handleClerkWebhook,
});

// Endpoint do zapraszania klienta do organizacji z dostępem do konkretnego projektu
http.route({
  path: "/invite-client",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { email, projectId, clerkOrgId } = body;

    if (!email || !projectId || !clerkOrgId) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Sprawdź autoryzację (opcjonalnie)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response("Not authenticated", { status: 401 });
    }

    try {
      // Zapisz tymczasowo informację o zaproszeniu w bazie
      await ctx.runMutation(internal.teams.createPendingClientInvitation, {
        email,
        projectId,
        clerkOrgId,
        invitedBy: identity.subject,
      });

      // Wywołaj Clerk API do zaproszenia do organizacji
      const clerkResponse = await fetch(`https://api.clerk.dev/v1/organizations/${clerkOrgId}/invitations`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: email,
          role: "org:customer",
          public_metadata: {
            invited_to_project: projectId, // Metadane do identyfikacji w webhook
          }
        }),
      });

      if (!clerkResponse.ok) {
        const error = await clerkResponse.text();
        throw new Error(`Clerk API error: ${error}`);
      }

      const invitation = await clerkResponse.json();
      return new Response(JSON.stringify({ success: true, invitation }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Error inviting client:", error);
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

export default http; 