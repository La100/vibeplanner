"use client";

import { useOrganizationList } from "@clerk/nextjs";
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";


export function SmartDashboard() {
  const router = useRouter();
  const { userMemberships, setActive, isLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const organizations = useMemo(
    () =>
      userMemberships?.data?.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        role: membership.role,
      })) || [],
    [userMemberships?.data]
  );
  const hasRedirectedRef = useRef(false);

  // Check for pending invitation ticket in URL and force reload after delay
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const clerkTicket = params.get('__clerk_ticket');

    if (clerkTicket) {
      // Give Clerk time to process the invitation (5 seconds)
      const timer = setTimeout(() => {
        // Remove ticket from URL and reload
        const url = new URL(window.location.href);
        url.searchParams.delete('__clerk_ticket');
        url.searchParams.delete('__clerk_status');
        window.location.replace(url.toString());
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, []);

  // Auto-redirect based on organization status
  useEffect(() => {
    if (!isLoaded || hasRedirectedRef.current) return;

    if (organizations.length >= 1) {
      // Has organization - redirect to it
      const org = organizations[0];
      (async () => {
        try {
          if (setActive) {
            await setActive({ organization: org.id });
          }
        } catch (error) {
          console.error("Failed to set active organization, continuing redirect", error);
        } finally {
          router.push("/organisation");
          hasRedirectedRef.current = true;
        }
      })();
    } else {
      // No organization - redirect to organisation
      router.push("/organisation");
      hasRedirectedRef.current = true;
    }
  }, [isLoaded, organizations, setActive, router]);

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
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Always show loading while redirecting (either to org or organisation)
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-muted-foreground">
          {organizations.length >= 1
            ? "Redirecting to your organization..."
            : "Redirecting to organisation..."}
        </p>
      </div>
    </div>
  );
}
