"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function GoogleCalendarErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    missing_params: "Missing required parameters. Please try connecting again.",
    invalid_state: "Invalid state parameter. Please try connecting again.",
    exchange_failed: "Failed to connect to Google Calendar. Please try again.",
    access_denied: "You denied access to Google Calendar.",
    default: "An error occurred while connecting to Google Calendar.",
  };

  const errorMessage = errorMessages[error || ""] || errorMessages.default;

  useEffect(() => {
    // Notify parent window if this is a popup
    if (window.opener) {
      window.opener.postMessage({ type: "google-calendar-connected", success: false, error }, "*");
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8 max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Connection Failed
        </h1>
        <p className="text-muted-foreground">
          {errorMessage}
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <Button variant="outline" onClick={() => window.close()}>
            Close
          </Button>
          <Button onClick={() => router.back()}>
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function GoogleCalendarErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    }>
      <GoogleCalendarErrorContent />
    </Suspense>
  );
}



