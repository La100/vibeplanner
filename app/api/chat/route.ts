import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, system, tools } = body as {
    messages: unknown;
    system?: unknown;
    tools?: unknown;
  };
  if (!messages) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    // Vercel AI SDK input is validated at runtime inside streamText
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    system: system as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: tools as any,
  });

  return result.toTextStreamResponse();
}

export const maxDuration = 120;
