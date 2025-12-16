"use client";

import { OrganizationList } from "@clerk/nextjs";

export default function OrganizationPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <OrganizationList
        hidePersonal
        afterSelectOrganizationUrl="/:slug"
        afterCreateOrganizationUrl="/:slug"
        hideSlug={true}
        skipInvitationScreen={true}
      />
    </div>
  );
} 