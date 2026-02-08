import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { Id } from "@/convex/_generated/dataModel";
import { auth } from "@clerk/nextjs/server";
import type { FunctionReference } from "convex/server";

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

    // Call streaming chat action
    type SendMessageResult = {
      success: boolean;
      threadId: string;
      agentThreadId?: string;
      error?: string;
    };

    // Use makeFunctionReference to avoid type instantiation issues
    const functionRef = {
      _name: "ai/streaming:startStreamingChat"
    } as unknown as FunctionReference<"action">;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: SendMessageResult = await (convex as any).action(
      functionRef,
      {
        message,
        projectId: projectId as Id<"projects">,
        userClerkId,
        threadId: actualThreadId,
        fileId: fileId as Id<"files"> | undefined,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to get response" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      threadId: result.threadId,
      agentThreadId: result.agentThreadId,
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
