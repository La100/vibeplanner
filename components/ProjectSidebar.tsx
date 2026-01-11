"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense } from "react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ArrowLeft,
  LayoutDashboard,
  Settings,
  Calendar,
  ShoppingCart,
  CheckSquare,
  Files,
  Sparkles,
  ClipboardList,
  Contact,
  StickyNote,
  Image,
  Hammer,
  Calculator,
} from "lucide-react";

function ProjectSidebarContent() {
  const params = useParams<{ slug: string; projectSlug: string }>();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { project, team, permissions: sidebarPermissions } = useProject();

  const allNavItems = [
    { href: `/${params.slug}/${params.projectSlug}`, label: "Overview", icon: LayoutDashboard, key: "overview" },
    { href: `/${params.slug}/${params.projectSlug}/tasks`, label: "Tasks", icon: CheckSquare, key: "tasks" },
    { href: `/${params.slug}/${params.projectSlug}/moodboard`, label: "Moodboard", icon: Image, key: "moodboard" },
    { href: `/${params.slug}/${params.projectSlug}/notes`, label: "Notes", icon: StickyNote, key: "notes" },
    { href: `/${params.slug}/${params.projectSlug}/contacts`, label: "Contacts", icon: Contact, key: "contacts" },
    { href: `/${params.slug}/${params.projectSlug}/surveys`, label: "Surveys", icon: ClipboardList, key: "surveys" },
    { href: `/${params.slug}/${params.projectSlug}/calendar`, label: "Google Calendar", icon: Calendar, key: "calendar" },
    { href: `/${params.slug}/${params.projectSlug}/files`, label: "Files", icon: Files, key: "files" },
    { href: `/${params.slug}/${params.projectSlug}/shopping-list`, label: "Materials", icon: ShoppingCart, key: "shopping_list" },
    { href: `/${params.slug}/${params.projectSlug}/labor`, label: "Labor", icon: Hammer, key: "labor" },
    { href: `/${params.slug}/${params.projectSlug}/estimations`, label: "Estimations", icon: Calculator, key: "estimations" },
  ];

  const aiItem = { href: `/${params.slug}/${params.projectSlug}/ai`, label: "AI Assistant", icon: Sparkles, key: "ai" };
  const settingsItem = { href: `/${params.slug}/${params.projectSlug}/settings`, label: "Settings", icon: Settings, key: "settings" };

  const navItems = sidebarPermissions?.permissions
    ? allNavItems.filter((item) => sidebarPermissions.permissions?.[item.key as keyof typeof sidebarPermissions.permissions]?.visible !== false)
    : allNavItems;

  const showSettings =
    sidebarPermissions?.permissions?.settings?.visible !== false;

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  const handleLinkHover = (href: string) => {
    router.prefetch(href);
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex flex-col gap-0.5 py-4 px-4">
          <Link
            href={`/${params.slug}`}
            onClick={handleLinkClick}
            onMouseEnter={() => handleLinkHover(`/${params.slug}`)}
            className="flex items-center gap-2 group mb-3 text-sidebar-foreground/70"
          >
            <ArrowLeft className="h-4 w-4 text-sidebar-foreground/50" />
            <span className="text-[10px] font-medium tracking-[0.2em] uppercase">
              {team?.name || "Organization"}
            </span>
          </Link>

          <div className="px-0.5">
            <h2 className="text-xl font-medium tracking-tight text-sidebar-foreground leading-tight font-[var(--font-display-serif)]">
              {project.name}
            </h2>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col">
        <SidebarGroup className="flex-1">
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

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent className="px-2 pb-2">
            <Link
              href={aiItem.href}
              onClick={handleLinkClick}
              onMouseEnter={() => handleLinkHover(aiItem.href)}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all duration-200 shadow-sm"
            >
              <aiItem.icon className="h-4 w-4" />
              <span className="text-sm font-semibold tracking-tight">{aiItem.label}</span>
            </Link>
          </SidebarGroupContent>
        </SidebarGroup>

        {showSettings && (
          <SidebarGroup className="border-t border-sidebar-border">
            <SidebarGroupContent className="pt-2">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="h-10 justify-start gap-3 rounded-lg px-3 text-sm font-medium tracking-tight text-sidebar-foreground">
                    <Link
                      href={settingsItem.href}
                      onClick={handleLinkClick}
                      onMouseEnter={() => handleLinkHover(settingsItem.href)}
                      className="flex items-center gap-2"
                    >
                      <settingsItem.icon className="h-4 w-4 text-sidebar-foreground/70" />
                      <span>{settingsItem.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

export function ProjectSidebar() {
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
      }
    >
      <ProjectSidebarContent />
    </Suspense>
  );
}
