"use client";

import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useEffect } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { CompanySidebar } from "@/components/CompanySidebar";
import { useOrganization } from "@clerk/nextjs";

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { organization } = useOrganization();

  const userRole = useQuery(
    apiAny.teams.getCurrentUserRoleInClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  useEffect(() => {
    if (userRole === "customer") {
      const allowedPaths = ["/organisation"];
      if (!allowedPaths.some(path => pathname === path)) {
        router.push("/organisation");
      }
    }
  }, [userRole, pathname, router]);

  return (
    <SidebarProvider>
      <CompanySidebar />
      <SidebarInset>
        <header className="xl:hidden flex h-16 items-center gap-2 px-4 border-b bg-background">
          <SidebarTrigger className="-ml-1 [&.hidden]:flex" />
        </header>
        <main className="flex-1 min-h-0 overflow-auto p-4 xl:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
} 
