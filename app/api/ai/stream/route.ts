import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { auth } from "@clerk/nextjs/server";

/**
 * AI Chat endpoint - simple request/response (no streaming)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, projectId, userClerkId, threadId, fileId } = body;

    if (!message || !projectId || !userClerkId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get auth token from Clerk
    const { getToken } = await auth();
    const token = await getToken({ template: "convex" });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - no token" },
        { status: 401 }
      );
    }

    // Create client with auth token
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(token);

    // Generate threadId if not provided
    const actualThreadId = threadId && threadId.trim().length > 0
      ? threadId
      : `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Call simple chat action - waits for full response
    // @ts-expect-error - Convex type instantiation depth issue
    const result = await convex.action(api.ai.chat.sendMessage, {
      message,
      projectId: projectId as Id<"projects">,
      userClerkId,
      threadId: actualThreadId,
      fileId: fileId as Id<"files"> | undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to get response" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      threadId: result.threadId,
      response: result.response,
      tokenUsage: result.tokenUsage,
    });
  } catch (error) {
    console.error("Error in AI chat endpoint:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Allow longer timeouts for AI responses
export const maxDuration = 120;
