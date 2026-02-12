# Assistant Creation Guidelines

Purpose: keep assistant templates consistent without duplicating platform behavior.

## What belongs in assistant SOUL templates
- Persona and voice (tone, energy, style).
- Domain expertise (fitness, stoicism, mindfulness, etc.).
- Domain-specific heuristics and coaching philosophy.
- What to emphasize or avoid for that assistant's niche.

## What should stay global (not repeated per soul)
- Tool protocol (create/update habits/tasks/reminders only via tools).
- Reminder encoding rules (`reminderPlan` for phased schedules).
- Reminder time precision (no minute drift).
- Telegram setup/linking flow and secret-handling rules.
- Shared onboarding mechanics (one question at a time, approval before writes).

Global rules live in:
- `/Users/cinu/Desktop/vibeplanner/convex/ai/onboarding/assistantRules.ts`
- `/Users/cinu/Desktop/vibeplanner/convex/ai/systemPrompt.ts`
- `/Users/cinu/Desktop/vibeplanner/convex/ai/streaming.ts`

SOUL templates live in:
- `/Users/cinu/Desktop/vibeplanner/convex/ai/souls/client.ts`

## Behavioral plan baseline (Monk only)
For the Monk preset, behavior-change onboarding can include a baseline stack unless user opts out:
- Meditation
- Breathwork (Wim Hof if tolerated, otherwise gentler breathing)
- Yoga Nidra / NSDR
- Daily walk

Keep these measurable, realistic, and easy to start. Do not force this stack for non-behavioral presets (e.g., Gym Bro).

## Design checks before shipping a new assistant
1. SOUL text is concise and domain-focused.
2. No duplicated global tooling/reminder/Telegram instructions.
3. Onboarding behavior remains compatible with global rules.
4. Example plans use structured data (not prose-only schedule logic).
