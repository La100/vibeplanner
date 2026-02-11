import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "../_generated/server";
import { getCurrentDateTime } from "./helpers/contextBuilder";

const MAX_LONG_TERM_MEMORY_CHARS = 8000;
const MAX_DAILY_MEMORY_CHARS = 12000;

function normalizeMemoryEntry(content: string): string {
    return content.trim().replace(/\s+/g, " ");
}

function appendToMemory(existing: string, addition: string): string {
    if (!addition) return existing;
    if (!existing) return addition;
    if (existing.includes(addition)) return existing;
    const combined = `${existing}\n- ${addition}`.replace(/\n{3,}/g, "\n\n");
    if (combined.length <= MAX_LONG_TERM_MEMORY_CHARS) return combined;

    // Trim from the top, keep the most recent lines
    const lines = combined.split("\n");
    const trimmed: string[] = [];
    for (let i = lines.length - 1; i >= 0; i--) {
        trimmed.unshift(lines[i]);
        if (trimmed.join("\n").length >= MAX_LONG_TERM_MEMORY_CHARS) {
            break;
        }
    }
    return trimmed.join("\n");
}

export const SOUL_DEFAULT = `# SOUL.md - Professional Fitness Coach

You are a **professional Fitness & Health Coach**. Your role is to CREATE and deliver structured, professional workout plans.

## Golden Rules
1. **ALWAYS CREATE PROFESSIONAL PLANS** - structured with weeks, days, muscle groups
2. **BE PROACTIVE** - after learning the user's focus, immediately generate a full training plan
3. **Quality over quantity** - detailed exercises with sets x reps format
4. **No generic advice** - every exercise must have specific sets/reps/notes

## Professional Plan Structure (ALWAYS USE THIS FORMAT)

### Week 1
**Monday - [Muscle Group, e.g. Legs]**
1. Exercise Name - 3x12 (notes: technique details)
2. Exercise Name - 4x10
...

**Wednesday - [Muscle Group, e.g. Chest, Biceps]**
1. Exercise Name - 3x10
...

### Week 2
(progression from Week 1)
...

## Example Professional Exercises
✅ "Barbell squats (high trap bar) - 3x12"
✅ "Leg press (low foot placement) - 2x15"
✅ "Deadlift with dumbbells (pause 1 sec at bottom) - 3x8"
✅ "Bench press with 2 sec pause at bottom - 3x10"
✅ "Incline dumbbell press (45°) - 3x10"

❌ BAD: "Exercise 30 minutes daily"
❌ BAD: "Train regularly"
❌ BAD: "Do some squats"

## Workout Types (by focus)
- **Muscle Gain:** 3-4x per week, progressive overload, 8-12 reps
- **Strength:** 3x per week, heavy weights, 3-6 reps
- **Endurance:** 4-5x per week, higher reps, shorter rest
- **Weight Loss:** Mix of strength + cardio

## Onboarding Flow
1. ASK: Focus, experience level, available days, equipment
2. IMMEDIATELY generate a 2-4 week professional plan
3. Present the full plan with all exercises, sets, reps
4. Ask if they want any adjustments

## Tone
- Professional, like a certified personal trainer
- Confident and proactive
- Deliver complete plans, not questions
`;

export const AGENTS_DEFAULT = `# AGENTS.md - Your Workspace
This folder is home. Treat it that way.

## Every Session
Before doing anything else:
1. Read \`SOUL.md\` — this is who you are
2. Read \`USER.md\` — this is who you're helping
3. Read \`memory/YYYY-MM-DD.md\` (today + yesterday) for recent context
4. **If in MAIN SESSION**: Also read \`MEMORY.md\`

## Memory
You wake up fresh each session. These files are your continuity:
- **Daily notes:** \`memory/YYYY-MM-DD.md\` — raw logs of what happened
- **Long-term:** \`MEMORY.md\` — your curated memories, like a human's long-term memory
`;

export const ensureSystemFiles = mutation({
    args: {},
    handler: async (ctx) => {
        const files = [
            { slug: "soul", content: SOUL_DEFAULT },
            { slug: "agents", content: AGENTS_DEFAULT },
        ];

        for (const file of files) {
            const existing = await ctx.db
                .query("aiSystemFiles")
                .withIndex("by_slug", (q) => q.eq("slug", file.slug))
                .first();

            if (!existing) {
                await ctx.db.insert("aiSystemFiles", {
                    slug: file.slug,
                    content: file.content,
                    lastUpdated: Date.now(),
                });
            } else {
                if (existing.content !== file.content) {
                    await ctx.db.patch(existing._id, {
                        content: file.content,
                        lastUpdated: Date.now(),
                    });
                }
            }
        }
    },
});

export const getSystemContext = internalQuery({
    args: {
        projectId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args) => {
        // 1. Fetch Identity Files
        const soul = await ctx.db
            .query("aiSystemFiles")
            .withIndex("by_slug", (q) => q.eq("slug", "soul"))
            .first();

        const agents = await ctx.db
            .query("aiSystemFiles")
            .withIndex("by_slug", (q) => q.eq("slug", "agents"))
            .first();

        // 2. Fetch Recent Memory (Today) scoped to project
        const { currentDate } = getCurrentDateTime();
        let memoryQuery = ctx.db
            .query("aiMemories")
            .withIndex("by_date", (q) => q.eq("date", currentDate));

        if (args.projectId) {
            memoryQuery = memoryQuery.filter((q) => q.eq(q.field("projectId"), args.projectId));
        }

        const todayMemory = await memoryQuery.first();

        // 3. Fetch Long-term memory (per project)
        let longTermMemory = "";
        const projectId = args.projectId;
        if (projectId) {
            const longTermDoc = await ctx.db
                .query("aiLongTermMemories")
                .withIndex("by_project", (q) => q.eq("projectId", projectId))
                .first();
            longTermMemory = longTermDoc?.content || "";
        }

        return {
            identity: soul?.content || SOUL_DEFAULT,
            workspace: agents?.content || AGENTS_DEFAULT,
            todayMemory: todayMemory?.content || "",
            longTermMemory,
        };
    },
});

export const appendDailyMemory = internalMutation({
    args: {
        content: v.string(),
        threadId: v.string(),
        projectId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args) => {
        const { currentDate } = getCurrentDateTime();

        let memoryQuery = ctx.db
            .query("aiMemories")
            .withIndex("by_date", (q) => q.eq("date", currentDate));

        if (args.projectId) {
            memoryQuery = memoryQuery.filter((q) => q.eq(q.field("projectId"), args.projectId));
        }

        const existing = await memoryQuery.first();

        if (existing) {
            // Append to existing
            const combined = existing.content + "\n" + args.content;
            const newContent =
                combined.length > MAX_DAILY_MEMORY_CHARS
                    ? `...[older entries truncated]\n${combined.slice(-MAX_DAILY_MEMORY_CHARS)}`
                    : combined;
            const threadIds = existing.threadIds.includes(args.threadId)
                ? existing.threadIds
                : [...existing.threadIds, args.threadId];

            await ctx.db.patch(existing._id, {
                content: newContent,
                threadIds,
            });
        } else {
            // Create new
            await ctx.db.insert("aiMemories", {
                date: currentDate,
                type: "daily",
                content: args.content,
                threadIds: [args.threadId],
                projectId: args.projectId,
            });
        }
    },
});

export const getLongTermMemory = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const doc = await ctx.db
            .query("aiLongTermMemories")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .first();
        return doc?.content || "";
    },
});

export const updateLongTermMemory = mutation({
    args: { projectId: v.id("projects"), content: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const existing = await ctx.db
            .query("aiLongTermMemories")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, { content: args.content, updatedAt: Date.now() });
        } else if (args.content.trim()) {
            await ctx.db.insert("aiLongTermMemories", {
                projectId: args.projectId,
                content: args.content,
                threadIds: [],
                updatedAt: Date.now(),
            });
        }
    },
});

export const appendLongTermMemory = internalMutation({
    args: {
        projectId: v.id("projects"),
        content: v.string(),
        threadId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const normalized = normalizeMemoryEntry(args.content);
        if (!normalized) return;

        const existing = await ctx.db
            .query("aiLongTermMemories")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .first();

        if (existing) {
            const updatedContent = appendToMemory(existing.content, normalized);
            const threadIds = args.threadId
                ? existing.threadIds.includes(args.threadId)
                    ? existing.threadIds
                    : [...existing.threadIds, args.threadId]
                : existing.threadIds;
            await ctx.db.patch(existing._id, {
                content: updatedContent,
                threadIds,
                updatedAt: Date.now(),
            });
        } else {
            await ctx.db.insert("aiLongTermMemories", {
                projectId: args.projectId,
                content: `- ${normalized}`,
                threadIds: args.threadId ? [args.threadId] : [],
                updatedAt: Date.now(),
            });
        }
    },
});
