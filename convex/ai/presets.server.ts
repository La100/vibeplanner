/**
 * Assistant Presets - Predefined assistant configurations
 * 
 * Each preset includes a default SOUL that gets copied to the project on creation.
 * SOULs are defined in ./souls/index.ts for easy editing.
 */

import {
    WORKOUT_COACH_SOUL,
    CUSTOM_ASSISTANT_SOUL,
    BUDDHA_ASSISTANT_SOUL,
    MARCUS_AURELIUS_SOUL,
} from "./souls";

export interface AssistantPreset {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    defaultSoul: string; // Full SOUL.md content copied to project on creation
    onboardingPrompt?: string;
}

export const ASSISTANT_PRESETS: AssistantPreset[] = [
    {
        id: "gymbro",
        name: "Gym Bro",
        description: "Professional trainer delivering structured workout plans.",
        icon: "GB",
        color: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800",
        defaultSoul: WORKOUT_COACH_SOUL,
    },
    {
        id: "custom",
        name: "Custom Assistant",
        description: "Professional project assistant with sensible defaults.",
        icon: "CU",
        color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
        defaultSoul: CUSTOM_ASSISTANT_SOUL,
    },
    {
        id: "buddha",
        name: "Monk",
        description: "Mindfulness assistant for calm, clarity, and daily practice.",
        icon: "MK",
        color: "bg-teal-500/10 text-teal-700 border-teal-200 dark:border-teal-800",
        defaultSoul: BUDDHA_ASSISTANT_SOUL,
    },
    {
        id: "marcus",
        name: "Marcus Aurelius",
        description: "Stoicism-focused assistant for clarity, resilience, and discipline.",
        icon: "MA",
        color: "bg-stone-500/10 text-stone-700 border-stone-200 dark:border-stone-800",
        defaultSoul: MARCUS_AURELIUS_SOUL,
    },
];

export const getPreset = (presetId: string): AssistantPreset | undefined => {
    return ASSISTANT_PRESETS.find(p => p.id === presetId);
};
