# AGENTS.md

Purpose: Fast, consistent onboarding for AI agents working in this repo.

## Project Summary
VibePlanner is an AI habit planner. It helps users build routines, track streaks, and stay accountable with AI assistants.

## Primary Stack
- Next.js 15 (App Router) + React 19
- Convex backend (queries, mutations, actions)
- Clerk for auth (Organizations map to internal org entities)
- Stripe for billing
- Tailwind CSS + shadcn/ui

## Key Domain Model (Convex)
- Backend schema still uses legacy internal entity names, so keep it stable unless explicitly requested.
- Product-facing positioning and landing copy should be habits-first (habits, routines, streaks, accountability, AI coaching).
- AI: threads/messages + token usage tracking.

## Important Paths
- `app/`: Next.js routes (App Router).
- `app/(main)/page.tsx`: Marketing landing page entry.
- `components/ui/landing/`: Landing UI components.
- `convex/`: Backend logic and schema.
- `convex/schema.ts`: Source of truth for data model.
- `components/`: Feature and UI components.
- `app/globals.css`: Theme tokens and global styles.

## Local Dev
- `pnpm dev` runs Next.js + Convex dev servers.
- `pnpm lint` for linting.

## Environment
Create `.env.local` with keys for Clerk, Convex, OpenAI, Stripe, and storage (R2/S3). Avoid committing secrets.

## Auth + Billing Notes
- Clerk orgs map to internal auth entities; be careful when touching org logic.
- Stripe actions live in `convex/stripeActions.ts`.

## UI/UX Notes
- Theme tokens live in `app/globals.css` (beige/ink palette). Reuse them instead of hardcoding colors.
- Landing components are in `components/ui/landing/` and mounted at `app/(main)/page.tsx`.
- For marketing/content updates, use `components/ui/landing/minimal/` as the primary source.

## Conventions
- Prefer component reuse from `components/ui`.
- Tailwind utility classes; avoid inline styles unless necessary.
- Keep marketing copy concrete and aligned to habits (habits, routines, streaks, check-ins, AI assistants).
- When touching Convex schema or auth flows, call out migration or data-impact risks.

## Safe Editing Guidelines
- Do not modify `convex/schema.ts` without explicit user request.
- Avoid renaming routes or folders unless requested.
- Use existing fonts and theme tokens defined in `app/globals.css`.
