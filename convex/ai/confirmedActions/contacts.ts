/**
 * Confirmed Actions - Contacts
 * 
 * Contact CRUD operations that require user confirmation from AI suggestions.
 */

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { ensureTeamMembership } from "./helpers";

export const createConfirmedContact = action({
  args: {
    teamSlug: v.string(),
    contactData: v.object({
      name: v.string(),
      companyName: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      city: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      website: v.optional(v.string()),
      taxId: v.optional(v.string()),
      type: v.union(v.literal("contractor"), v.literal("supplier"), v.literal("subcontractor"), v.literal("other")),
      notes: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    contactId: v.optional(v.id("contacts")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const team = await ctx.runQuery(api.teams.getTeamBySlug, { slug: args.teamSlug });
      if (!team) {
        throw new Error("Team not found");
      }
      await ensureTeamMembership(ctx, team._id);

      const contactId: any = await ctx.runMutation(api.contacts.createContact, {
        teamSlug: args.teamSlug,
        name: args.contactData.name,
        companyName: args.contactData.companyName,
        email: args.contactData.email,
        phone: args.contactData.phone,
        address: args.contactData.address,
        city: args.contactData.city,
        postalCode: args.contactData.postalCode,
        website: args.contactData.website,
        taxId: args.contactData.taxId,
        type: args.contactData.type,
        notes: args.contactData.notes,
      });

      return {
        success: true,
        contactId,
        message: "Contact created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create contact: ${error}`,
      };
    }
  },
});

export const deleteConfirmedContact = action({
  args: {
    contactId: v.id("contacts"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const contact = await ctx.runQuery(api.contacts.getContact, { contactId: args.contactId });
      if (!contact) {
        throw new Error("Contact not found");
      }
      await ensureTeamMembership(ctx, contact.teamId as Id<"teams">);

      await ctx.runMutation(api.contacts.deleteContact, {
        contactId: args.contactId,
      });

      return {
        success: true,
        message: "Contact deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete contact: ${error}`,
      };
    }
  },
});








