"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProject } from "@/components/providers/ProjectProvider";
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
  Calendar,
  GanttChartSquare,
  ShoppingCart,
  ArrowLeft,
  CheckSquare,
  Files,
  Sparkles,
  MessageSquare,
  ClipboardList,
  Contact,
  StickyNote
} from "lucide-react";
import { Suspense } from "react";

function ProjectSidebarContent() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { project, permissions: sidebarPermissions } = useProject();

  // Get unread counts for project channels
  const unreadCounts = useQuery(api.chatMessages.getAllUnreadCounts, {
    projectId: project._id,
  });

  // Calculate total unread messages
  const totalUnreadCount = unreadCounts ? Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) : 0;

  const allNavItems = [
    { href: `/${params.slug}/${params.projectSlug}`, label: "Overview", icon: LayoutDashboard, key: "overview" },
    { href: `/${params.slug}/${params.projectSlug}/tasks`, label: "Tasks", icon: CheckSquare, key: "tasks" },
    { href: `/${params.slug}/${params.projectSlug}/notes`, label: "Notes", icon: StickyNote, key: "notes" },
    { href: `/${params.slug}/${params.projectSlug}/contacts`, label: "Contacts", icon: Contact, key: "contacts" },
    { href: `/${params.slug}/${params.projectSlug}/chat`, label: "Chat", icon: MessageSquare, key: "chat", hasUnread: totalUnreadCount > 0 },
    { href: `/${params.slug}/${params.projectSlug}/surveys`, label: "Surveys", icon: ClipboardList, key: "surveys" },
    { href: `/${params.slug}/${params.projectSlug}/ai`, label: "AI", icon: Sparkles, key: "ai" },
    { href: `/${params.slug}/${params.projectSlug}/calendar`, label: "Calendar", icon: Calendar, key: "calendar" },
    { href: `/${params.slug}/${params.projectSlug}/gantt`, label: "Gantt", icon: GanttChartSquare, key: "gantt" },
    { href: `/${params.slug}/${params.projectSlug}/files`, label: "Files", icon: Files, key: "files" },
    { href: `/${params.slug}/${params.projectSlug}/shopping-list`, label: "Shopping List", icon: ShoppingCart, key: "shopping_list" },
    { href: `/${params.slug}/${params.projectSlug}/settings`, label: "Settings", icon: Settings, key: "settings" },
  ];

  // Filter navigation items based on permissions
  const navItems = sidebarPermissions?.permissions ? allNavItems.filter(item => {
    const permission = sidebarPermissions.permissions![item.key as keyof typeof sidebarPermissions.permissions];
    return permission?.visible !== false; // Show item if permission is undefined or visible is true
  }) : allNavItems;

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
              {project.name}
            </h2>
            
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
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                      {'hasUnread' in item && item.hasUnread && (
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                      )}
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