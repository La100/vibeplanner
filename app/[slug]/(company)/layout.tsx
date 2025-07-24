"use client";

import { useParams, useRouter, usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { CompanySidebar } from "@/components/CompanySidebar";

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const pathname = usePathname();
  
  const userRole = useQuery(api.teams.getCurrentUserRoleInTeam,
    params.slug ? { teamSlug: params.slug } : "skip"
  );

  useEffect(() => {
    if (userRole === "customer") {
      const allowedPaths = [`/${params.slug}`];
      if (!allowedPaths.some(path => pathname === path)) {
        router.push(`/${params.slug}`);
      }
    }
  }, [userRole, pathname, router, params.slug]);

  return (
    <SidebarProvider>
      <CompanySidebar />
      <SidebarInset>
        <header className="lg:hidden flex h-16 items-center gap-2 px-4 border-b bg-background">
          <SidebarTrigger className="-ml-1 [&.hidden]:flex" />
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
} 