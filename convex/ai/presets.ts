/**
 * Assistant Presets - Client-safe definitions for UI
 * Source of truth: convex/ai/souls/**.md (synced into convex/ai/souls/client.ts)
 */

import {
  WORKOUT_COACH_SOUL,
  CUSTOM_ASSISTANT_SOUL,
  MARTIN_ASSISTANT_SOUL,
  BUDDHA_ASSISTANT_SOUL,
  MARCUS_AURELIUS_SOUL,
  STARTUP_ASSISTANT_SOUL,
} from "./souls/client";

export interface AssistantPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultSoul: string; // Full SOUL.md content copied to project on creation
  onboardingPrompt?: string;
  image?: string;
  gradient?: string;
  backgroundClass?: string;
}

export const ASSISTANT_PRESETS: AssistantPreset[] = [
  {
    id: "marcus",
    name: "Marcus Aurelius",
    description: "Stoicism-focused assistant for clarity, resilience, and discipline.",
    icon: "MA",
    color: "bg-stone-500/10 text-stone-700 border-stone-200 dark:border-stone-800",
    defaultSoul: MARCUS_AURELIUS_SOUL,
    image: "/assistants/marcus/image.webp",

    gradient: "from-stone-600 to-stone-800",
  },
  {
    id: "gymbro",
    name: "Gym Bro",
    description: "Professional trainer delivering structured workout plans.",
    icon: "GB",
    color: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800",
    defaultSoul: WORKOUT_COACH_SOUL,
    image: "/assistants/gymbro/image.jpg",

    gradient: "from-slate-900 to-slate-800",
  },
  {
    id: "custom",
    name: "Custom Assistant",
    description: "Professional project assistant with sensible defaults.",
    icon: "CU",
    color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
    defaultSoul: CUSTOM_ASSISTANT_SOUL,
    backgroundClass: "bg-blue-600",
    gradient: "from-blue-600 to-indigo-700",
  },
  {
    id: "martin",
    name: "Martin",
    description: "Personal assistant for habits, focus blocks, and routines.",
    icon: "MT",
    color: "bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800",
    defaultSoul: MARTIN_ASSISTANT_SOUL,
    image: "/assistants/martin/image.png",

    gradient: "from-orange-500 to-red-600",
  },
  {
    id: "buddha",
    name: "Monk",
    description: "Mindfulness assistant for calm, clarity, and daily practice.",
    icon: "MK",
    color: "bg-teal-500/10 text-teal-700 border-teal-200 dark:border-teal-800",
    defaultSoul: BUDDHA_ASSISTANT_SOUL,
    image: "/assistants/buddha/image.jpeg",

    gradient: "from-emerald-600 to-teal-800",
  },
  {
    id: "startup",
    name: "Startup Mentor",
    description: "SaaS-focused mentor for validation, product, and execution.",
    icon: "SU",
    color: "bg-amber-500/10 text-amber-700 border-amber-200 dark:border-amber-800",
    defaultSoul: STARTUP_ASSISTANT_SOUL,
    image: "/assistants/startup/image.png",

    gradient: "from-violet-600 to-purple-800",
  },
];

export const getPreset = (presetId: string): AssistantPreset | undefined => {
  return ASSISTANT_PRESETS.find((p) => p.id === presetId);
};
