"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";


export function SmartDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const ensureMyTeam = useMutation(apiAny.teams.ensureMyTeam);
  const hasRedirectedRef = useRef(false);

  // Check for pending invitation ticket in URL and force reload after delay
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const clerkTicket = params.get('__clerk_ticket');

    if (clerkTicket) {
      console.log('[SmartDashboard] Invitation ticket detected, will reload after Clerk processes it...');

      // Give Clerk time to process the invitation (5 seconds)
      const timer = setTimeout(() => {
        console.log('[SmartDashboard] Reloading page to check organization membership...');
        // Remove ticket from URL and reload
        const url = new URL(window.location.href);
        url.searchParams.delete('__clerk_ticket');
        url.searchParams.delete('__clerk_status');
        window.location.replace(url.toString());
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, []);

  // Auto-redirect once workspace is ensured
  useEffect(() => {
    if (!user || hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    setIsCreatingWorkspace(true);
    setCreateError(null);

    ensureMyTeam({})
      .then(() => {
        router.push("/organisation");
      })
      .catch((error) => {
        console.error("Failed to set up workspace", error);
        setCreateError("Failed to set up your workspace. Please refresh.");
        setIsCreatingWorkspace(false);
        hasRedirectedRef.current = false;
      });
  }, [user, ensureMyTeam, router]);

  // Check if there's a pending invitation ticket
  const hasInvitationTicket = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('__clerk_ticket');

  // Show special loading for invitation acceptance
  if (hasInvitationTicket) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <h3 className="text-xl font-semibold">Processing your invitation...</h3>
          <p className="text-muted-foreground">
            We're adding you to the organization. This will take just a moment.
          </p>
        </div>
      </div>
    );
  }

  // Show loading while checking organizations
  if (!user) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (createError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3 max-w-md">
          <h3 className="text-xl font-semibold">
            {isCreatingWorkspace ? "Setting up your workspace..." : "Workspace unavailable"}
          </h3>
          <p className="text-muted-foreground">
            {createError}
          </p>
        </div>
      </div>
    );
  }

  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-muted-foreground">
          Redirecting to your workspace...
        </p>
      </div>
    </div>
  );
}
