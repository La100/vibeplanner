"use client";

import { useOrganizationList } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";


export function SmartDashboard() {
  const router = useRouter();
  const { userMemberships, setActive, isLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const organizations = userMemberships?.data?.map(membership => ({
    id: membership.organization.id,
    name: membership.organization.name,
    slug: membership.organization.slug,
    role: membership.role
  })) || [];

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

  // Auto-redirect based on organization status
  useEffect(() => {
    if (!isLoaded) return;

    if (organizations.length >= 1) {
      // Has organization - redirect to it
      const org = organizations[0];
      console.log("Redirecting to organization:", org);
      setActive?.({ organization: org.id }).then(() => {
        console.log("Organization set, pushing to:", `/${org.slug}`);
        router.push(`/${org.slug}`);
      });
    } else {
      // No organization - redirect to onboarding
      console.log("No organization found, redirecting to onboarding");
      router.push("/onboarding");
    }
  }, [isLoaded, organizations.length, setActive, router, organizations]);

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

  // Always show loading while redirecting (either to org or onboarding)
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-muted-foreground">
          {organizations.length >= 1
            ? "Redirecting to your organization..."
            : "Redirecting to onboarding..."}
        </p>
      </div>
    </div>
  );
}
