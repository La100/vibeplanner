# AGENTS.md

Purpose: Fast, consistent onboarding for AI agents working in this repo.

## Project Summary
VibePlanner is an AI assistant workspace for teams. It combines projects, tasks, files, calendars, and AI chat in one product.

## Primary Stack
- Next.js 15 (App Router) + React 19
- Convex backend (queries, mutations, actions)
- Clerk for auth (Organizations map to Teams)
- Stripe for billing
- Tailwind CSS + shadcn/ui

## Key Domain Model (Convex)
- Teams: top-level org, subscription status, settings.
- Projects: belong to a team, contain tasks/files/calendar.
- Tasks: kanban workflow (todo, in_progress, review, done).
- Files: unified storage, AI extraction/analysis.
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
- Clerk orgs map to Teams; be careful when touching org/team logic.
- Stripe actions live in `convex/stripeActions.ts`.

## UI/UX Notes
- Theme tokens live in `app/globals.css` (beige/ink palette). Reuse them instead of hardcoding colors.
- Landing components are in `components/ui/landing/` and mounted at `app/(main)/page.tsx`.

## Conventions
- Prefer component reuse from `components/ui`.
- Tailwind utility classes; avoid inline styles unless necessary.
- Keep marketing copy concrete and aligned to the product (teams, projects, tasks, files, AI).
- When touching Convex schema or auth flows, call out migration or data-impact risks.

## Safe Editing Guidelines
- Do not modify `convex/schema.ts` without explicit user request.
- Avoid renaming routes or folders unless requested.
- Use existing fonts and theme tokens defined in `app/globals.css`.
