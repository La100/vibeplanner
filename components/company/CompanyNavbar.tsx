"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useClerk, useUser } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings,
  LifeBuoy,
  LogOut,
  UserCircle,
  ChevronsUpDown,
} from "lucide-react";

function NavIconButton({
  href,
  label,
  children,
  onPrefetch,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  onPrefetch: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          onMouseEnter={onPrefetch}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-foreground/[0.06] hover:text-foreground active:scale-95"
        >
          {children}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function CompanyNavbarContent() {
  const router = useRouter();
  const { signOut, openUserProfile } = useClerk();
  const { user } = useUser();

  const team = useQuery(apiAny.teams.getMyTeam);
  const ensureMyTeam = useMutation(apiAny.teams.ensureMyTeam);

  const userInitial =
    user?.fullName?.charAt(0) ||
    user?.firstName?.charAt(0) ||
    user?.primaryEmailAddress?.emailAddress?.charAt(0) ||
    "U";

  useEffect(() => {
    if (!team && user) {
      ensureMyTeam({}).catch(console.error);
    }
  }, [team, user, ensureMyTeam]);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="border-b border-border/60 bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-5 md:px-8">
      {/* Left: Brand / Team */}
      <Link
        href="/organisation"
        className="group flex items-center gap-3.5 rounded-2xl px-1 py-1 -ml-1 transition-all duration-200"
      >
        <div className="relative">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary text-sm font-bold shadow-sm transition-transform duration-200 group-hover:scale-105">
            {(team?.name || "W").charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[15px] font-semibold truncate leading-tight text-foreground font-[var(--font-display-serif)] transition-colors duration-200 group-hover:text-foreground/80">
            {team?.name || "Loading..."}
          </span>
          <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-[0.16em] leading-none mt-0.5">
            Personal Workspace
          </span>
        </div>
      </Link>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <NavIconButton
          href="/organisation/settings"
          label="Settings"
          onPrefetch={() => router.prefetch("/organisation/settings")}
        >
          <Settings className="h-[18px] w-[18px]" />
        </NavIconButton>

        <NavIconButton
          href="/help"
          label="Help & Support"
          onPrefetch={() => router.prefetch("/help")}
        >
          <LifeBuoy className="h-[18px] w-[18px]" />
        </NavIconButton>

        <Separator
          orientation="vertical"
          className="mx-2 h-6 bg-border/50"
        />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-2.5 transition-all duration-200 hover:bg-foreground/[0.06] active:scale-[0.98]"
            >
              <Avatar className="h-8 w-8 ring-2 ring-border/40 ring-offset-1 ring-offset-background transition-all duration-200 group-hover:ring-primary/30">
                <AvatarImage
                  src={user?.imageUrl}
                  alt={user?.fullName || user?.firstName || "User"}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {userInitial.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block max-w-[120px] truncate text-sm font-medium text-foreground">
                {user?.firstName || user?.fullName || "Account"}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-72 rounded-xl border border-border/60 p-1.5 shadow-lg shadow-black/[0.06]"
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <Avatar className="h-10 w-10 ring-2 ring-border/30 ring-offset-2 ring-offset-background">
                <AvatarImage
                  src={user?.imageUrl}
                  alt={user?.fullName || user?.firstName || "User"}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {userInitial.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {user?.fullName || user?.firstName || "Account"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.primaryEmailAddress?.emailAddress || ""}
                </p>
              </div>
            </div>
            <DropdownMenuSeparator className="mx-1" />
            <DropdownMenuItem
              onClick={() => openUserProfile?.()}
              className="rounded-lg px-3 py-2.5 gap-3"
            >
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              <span>Manage account</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut()}
              className="rounded-lg px-3 py-2.5 gap-3 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>
    </motion.nav>
  );
}

function NavbarSkeleton() {
  return (
    <nav className="border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-5 md:px-8">
      <div className="flex items-center gap-3.5">
        <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-28 bg-muted rounded-md animate-pulse" />
          <div className="h-2.5 w-20 bg-muted/60 rounded-md animate-pulse" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-muted/60 animate-pulse" />
        <div className="h-8 w-8 rounded-xl bg-muted/60 animate-pulse" />
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
      </div>
      </div>
    </nav>
  );
}

export function CompanyNavbar() {
  return (
    <Suspense fallback={<NavbarSkeleton />}>
      <CompanyNavbarContent />
    </Suspense>
  );
}
