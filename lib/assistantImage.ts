import { getPreset } from "@/convex/ai/presets";

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
  return undefined;
}
