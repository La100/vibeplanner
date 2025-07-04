"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
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
  useSidebar
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard,
  Settings, 
  Users,
  FolderOpen,
  ArrowLeft,
  BarChart3
} from "lucide-react";
import { Suspense } from "react";

function CompanySidebarContent() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { organization } = useOrganization();
  
  const team = useQuery(api.myFunctions.getTeamBySlug, 
    params.slug ? { slug: params.slug } : "skip"
  );

  const navItems = [
    { href: `/${params.slug}`, label: "Dashboard", icon: LayoutDashboard },
    { href: `/${params.slug}/projects`, label: "Projects", icon: FolderOpen },
    { href: `/${params.slug}/team`, label: "Team", icon: Users },
    { href: `/${params.slug}/reports`, label: "Reports", icon: BarChart3 },
    { href: `/${params.slug}/settings`, label: "Settings", icon: Settings },
  ];

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  const handleLinkHover = (href: string) => {
    router.prefetch(href);
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex flex-col gap-2 py-2 px-2">
          <SidebarMenuButton asChild>
            <Link 
              href="/"
              onClick={handleLinkClick}
              onMouseEnter={() => handleLinkHover("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
          </SidebarMenuButton>
          
          <div className="px-2 py-1">
            <h2 className="text-lg font-semibold text-sidebar-foreground/90">
              {organization?.name || team?.name || "Loading..."}
            </h2>
            <p className="text-sm text-sidebar-foreground/60">
              Company Dashboard
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link 
                      href={item.href}
                      onClick={handleLinkClick}
                      onMouseEnter={() => handleLinkHover(item.href)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
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
    <Suspense fallback={
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
    }>
      <CompanySidebarContent />
    </Suspense>
  );
}