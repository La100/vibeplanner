"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard,
  Settings, 
  Calendar,
  GanttChartSquare,
  ShoppingCart,
  ArrowLeft,
  CheckSquare,
  Files,
  Home
} from "lucide-react";
import { Suspense } from "react";

function ProjectSidebarContent() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  
  const project = useQuery(api.myFunctions.getProjectBySlug, { 
    teamSlug: params.slug, 
    projectSlug: params.projectSlug 
  });

  const navItems = [
    { href: `/${params.slug}/${params.projectSlug}`, label: "Overview", icon: LayoutDashboard },
    { href: `/${params.slug}/${params.projectSlug}/tasks`, label: "Tasks", icon: CheckSquare },
    { href: `/${params.slug}/${params.projectSlug}/calendar`, label: "Calendar", icon: Calendar },
    { href: `/${params.slug}/${params.projectSlug}/gantt`, label: "Gantt", icon: GanttChartSquare },
    { href: `/${params.slug}/${params.projectSlug}/files`, label: "Files", icon: Files },
    { href: `/${params.slug}/${params.projectSlug}/shopping-list`, label: "Shopping List", icon: ShoppingCart },
    { href: `/${params.slug}/${params.projectSlug}/settings`, label: "Settings", icon: Settings },
  ];

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  const handleLinkHover = (href: string) => {
    // Prefetch the route when user hovers over the link
    router.prefetch(href);
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex flex-col gap-2 py-2 px-2">
          <SidebarMenuButton asChild>
            <Link 
              href={`/${params.slug}`}
              onClick={handleLinkClick}
              onMouseEnter={() => handleLinkHover(`/${params.slug}`)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Team</span>
            </Link>
          </SidebarMenuButton>
          
          <div className="px-2 py-1">
            <h2 className="text-lg font-semibold text-sidebar-foreground/90">
              {project?.name || "Loading..."}
            </h2>
            <p className="text-sm text-sidebar-foreground/60">
              Project Management {project?.projectId && `(Project #${project.projectId})`}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
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

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link 
                href={`/${params.slug}`}
                onClick={handleLinkClick}
                onMouseEnter={() => handleLinkHover(`/${params.slug}`)}
              >
                <Home className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function ProjectSidebar() {
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
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {Array.from({ length: 7 }).map((_, i) => (
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
      <ProjectSidebarContent />
    </Suspense>
  );
} 