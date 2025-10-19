import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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

    // Call the Convex Agent action with advanced features (usage tracking, context search, etc.)
    const result = await convex.action(api.ai.agentChat.chatWithAgent, {
      message,
      projectId: projectId as Id<"projects">,
      userClerkId,
      threadId,
      fileId: fileId as Id<"files"> | undefined,
    });

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send metadata
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "metadata",
              mode: result.mode,
              tokenUsage: result.tokenUsage,
              threadId: result.threadId,
            }) + "\n"
          )
        );

        // Stream the response character by character for better UX
        const text = result.response;
        let i = 0;
        const interval = setInterval(() => {
          if (i < text.length) {
            const chunk = text.slice(i, i + 10); // Send 10 chars at a time
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "token",
                  delta: chunk,
                }) + "\n"
              )
            );
            i += 10;
          } else {
            clearInterval(interval);

            // Send pending items if any
            if (result.pendingItems && result.pendingItems.length > 0) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "pendingItems",
                    items: result.pendingItems,
                  }) + "\n"
                )
              );
            }

            controller.close();
          }
        }, 20); // 20ms delay between chunks for smooth streaming
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in AI stream endpoint:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
