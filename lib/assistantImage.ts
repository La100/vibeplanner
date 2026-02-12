import { getPreset } from "@/convex/ai/presets";

const LEGACY_PRESET_IMAGES: Record<string, string> = {
  martin: "/assistants/martin/image.png",
  startup: "/assistants/startup/image.png",
};

type ResolveAssistantImageArgs = {
  imageUrl?: string | null;
  assistantPreset?: string | null;
};

export function resolveAssistantImageUrl({
  imageUrl,
  assistantPreset,
}: ResolveAssistantImageArgs): string | undefined {
  if (imageUrl) return imageUrl;

  const presetId = assistantPreset ?? "";
  const presetImage = getPreset(presetId)?.image;
  if (presetImage) return presetImage;

  return LEGACY_PRESET_IMAGES[presetId];
}
