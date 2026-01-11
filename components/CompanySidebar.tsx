"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "convex/react";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Settings,
  Users,
  FolderOpen,
  BarChart3,
  Contact,
  Package,
  Sparkles,
} from "lucide-react";

function CompanySidebarContent() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  useOrganizationList({
    userMemberships: true,
  });
  const { organization } = useOrganization();

  const team = useQuery(
    api.teams.getTeamBySlug,
    params.slug ? { slug: params.slug } : "skip"
  );

  // Get current user role in team
  const userRole = useQuery(
    api.teams.getCurrentUserRoleInTeam,
    params.slug ? { teamSlug: params.slug } : "skip"
  );

  // Define navigation items based on user role
  const allNavItems = [
    { href: `/${params.slug}`, label: "Projects", icon: FolderOpen, allowedRoles: ["admin", "member"] },
    { href: `/${params.slug}/visualizations`, label: "Visualizations", icon: Sparkles, allowedRoles: ["admin", "member"] },
    { href: `/${params.slug}/product-library`, label: "Product Library", icon: Package, allowedRoles: ["admin", "member"] },
    { href: `/${params.slug}/team`, label: "Team", icon: Users, allowedRoles: ["admin", "member"] },
    { href: `/${params.slug}/contacts`, label: "Contacts", icon: Contact, allowedRoles: ["admin", "member"] },
    { href: `/${params.slug}/reports`, label: "Reports", icon: BarChart3, allowedRoles: ["admin", "member"] },
    { href: `/${params.slug}/settings`, label: "Settings", icon: Settings, allowedRoles: ["admin", "member"] },
  ];

  // Filter navigation items based on user role
  const navItems = allNavItems.filter(
    (item) => !userRole || item.allowedRoles.includes(userRole)
  );

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  const handleLinkHover = (href: string) => {
    router.prefetch(href);
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 py-4 px-4">
          <div className="flex-shrink-0">
            {organization?.imageUrl || team?.imageUrl ? (
              <div className="relative h-10 w-10 overflow-hidden rounded-md border border-sidebar-border/50">
                <Image
                  src={organization?.imageUrl || team?.imageUrl || ""}
                  alt={organization?.name || team?.name || "Organization"}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary font-bold">
                {(organization?.name || team?.name || "O").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-sm font-semibold text-sidebar-foreground truncate leading-none mb-1 font-[var(--font-display-serif)]">
              {organization?.name || team?.name || "Loading..."}
            </h2>
            <p className="text-[10px] text-sidebar-foreground/60 font-medium uppercase tracking-[0.15em] leading-none">
              Company Dashboard
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild className="h-10 justify-start gap-3 rounded-lg px-3 text-sm font-medium tracking-tight text-sidebar-foreground">
                    <Link
                      href={item.href}
                      onClick={handleLinkClick}
                      onMouseEnter={() => handleLinkHover(item.href)}
                      className="flex flex-1 items-center gap-3"
                    >
                      <item.icon className="h-4 w-4 text-sidebar-foreground/70" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function CompanySidebar() {
  return (
    <Suspense
      fallback={
        <Sidebar variant="inset">
          <SidebarHeader className="border-b border-sidebar-border">
            <div className="flex flex-col gap-2 py-2 px-2">
              <div className="px-2 py-1">
                <div className="h-7 bg-muted rounded animate-pulse mb-1" />
                <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <div className="h-10 bg-muted rounded animate-pulse mx-2 mb-1" />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      }
    >
      <CompanySidebarContent />
    </Suspense>
  );
}
