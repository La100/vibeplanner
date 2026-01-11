"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

export default function GoogleCalendarSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-close after 3 seconds if this is a popup
    const timer = setTimeout(() => {
      if (window.opener) {
        window.opener.postMessage({ type: "google-calendar-connected", success: true }, "*");
        window.close();
      } else {
        router.back();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Google Calendar Connected!
        </h1>
        <p className="text-muted-foreground">
          Your Google Calendar has been successfully connected. You can now sync events.
        </p>
        <p className="text-sm text-muted-foreground">
          Redirecting back...
        </p>
      </div>
    </div>
  );
}



