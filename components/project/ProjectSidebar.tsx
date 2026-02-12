"use client";

import Link from "next/link";
import NextImage from "next/image";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useProject } from "@/components/providers/ProjectProvider";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ArrowLeft,
  CheckSquare,
  Sparkles,
  LifeBuoy,
  LogOut,
  Settings2,
  ChevronDown,
  Calendar,
  Flame,
  Brain,
  LayoutDashboard,
  BookOpen,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { resolveAssistantImageUrl } from "@/lib/assistantImage";

function ProjectSidebarContent() {
  const params = useParams<{ projectSlug: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile, state, isMobile } = useSidebar();
  const { project, team } = useProject();
  const { signOut, openUserProfile } = useClerk();
  const { user } = useUser();

  const allNavItems = [
    { href: `/organisation/projects/${params.projectSlug}/dashboard`, label: "Dashboard", icon: LayoutDashboard, key: "dashboard", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/habits`, label: "Habits", icon: Flame, key: "habits", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/tasks`, label: "Tasks", icon: CheckSquare, key: "tasks", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/ai`, label: "Chat", icon: Sparkles, key: "ai", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/soul`, label: "SOUL", icon: Brain, key: "soul", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/calendar`, label: "Calendar", icon: Calendar, key: "calendar", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/diary`, label: "Diary", icon: BookOpen, key: "diary", group: "project" },
  ];

  const navItems = allNavItems;
  const projectNavItems = navItems.filter((item) => item.group === "project");

  const footerItems = [
    { href: "/help", label: "Help", icon: LifeBuoy },
    { href: `/organisation/projects/${params.projectSlug}/settings`, label: "Project", icon: Settings2 },
  ];

  const userInitial =
    user?.fullName?.charAt(0) ||
    user?.firstName?.charAt(0) ||
    user?.primaryEmailAddress?.emailAddress?.charAt(0) ||
    "U";
  const resolvedAssistantImageUrl = resolveAssistantImageUrl({
    imageUrl: project?.imageUrl,
    assistantPreset: project?.assistantPreset,
  });

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  const handleLinkHover = (href: string) => {
    router.prefetch(href);
  };

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex flex-col gap-3 px-3 py-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/organisation"
                onClick={handleLinkClick}
                onMouseEnter={() => handleLinkHover("/organisation")}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-sidebar-foreground/70 transition hover:bg-sidebar-accent/50 group-data-[collapsible=icon]:justify-center"
              >
                <ArrowLeft className="h-4 w-4 text-sidebar-primary/80" />
                <span className="text-[10px] font-medium tracking-[0.2em] uppercase group-data-[collapsible=icon]:hidden">
                  {team?.name || "Organization"}
                </span>
              </Link>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="center"
              hidden={state !== "collapsed" || isMobile}
            >
              {team?.name || "Organization"}
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-3 px-1 group-data-[collapsible=icon]:justify-center">
            {resolvedAssistantImageUrl ? (
              <div className="relative h-10 w-10 overflow-hidden rounded-full border border-sidebar-border/40">
                <NextImage
                  src={resolvedAssistantImageUrl}
                  alt={project.name || "Project"}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-primary font-semibold">
                {project.name?.charAt(0)?.toUpperCase() || "P"}
              </div>
            )}
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <h2 className="text-lg font-medium tracking-tight text-sidebar-foreground leading-tight font-[var(--font-display-serif)] truncate">
                {project.name}
              </h2>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col">
        <SidebarGroup className="flex-1">
          <SidebarGroupContent className="group-data-[collapsible=icon]:px-0">
            <SidebarGroupLabel className="text-xs uppercase tracking-[0.2em] text-sidebar-foreground/60">
              Menu
            </SidebarGroupLabel>
            <SidebarMenu className="space-y-1 group-data-[collapsible=icon]:items-center">
              {projectNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname?.startsWith(item.href)}
                    tooltip={item.label}
                    className="h-10 justify-start gap-3 rounded-lg px-3 text-sm font-medium tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                  >
                    <Link
                      href={item.href}
                      onClick={handleLinkClick}
                      onMouseEnter={() => handleLinkHover(item.href)}
                      className="flex flex-1 items-center gap-3 group-data-[collapsible=icon]:justify-center"
                    >
                      <item.icon className="h-4 w-4 text-sidebar-primary/80" />
                      <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="border-t border-sidebar-border">
          <SidebarGroupContent className="pt-2 group-data-[collapsible=icon]:px-0">
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              {footerItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.label}
                    className="h-10 justify-start gap-3 rounded-lg px-3 text-sm font-medium tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                  >
                    <Link
                      href={item.href}
                      onClick={handleLinkClick}
                      onMouseEnter={() => handleLinkHover(item.href)}
                      className="flex flex-1 items-center gap-3 group-data-[collapsible=icon]:justify-center"
                    >
                      <item.icon className="h-4 w-4 text-sidebar-primary/80" />
                      <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
          <SidebarGroupContent className="px-2 pb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  type="button"
                  tooltip="Account"
                  className="h-12 justify-start gap-3 rounded-lg px-3 text-sm font-medium tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:size-12 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                >
                  {user?.imageUrl ? (
                    <div className="relative h-9 w-9 overflow-hidden rounded-full border border-sidebar-border/50">
                      <NextImage
                        src={user.imageUrl}
                        alt={user.fullName || user.firstName || "User"}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                      {userInitial.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-semibold text-sidebar-foreground truncate">
                      {user?.fullName || user?.firstName || "Account"}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60 truncate">
                      {user?.primaryEmailAddress?.emailAddress || ""}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-sidebar-primary/70 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-foreground">
                    {user?.fullName || user?.firstName || "Account"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.primaryEmailAddress?.emailAddress || ""}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openUserProfile?.()}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Manage account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
                  {Array.from({ length: 6 }).map((_, i) => (
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
