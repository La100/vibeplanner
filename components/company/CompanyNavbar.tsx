"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useClerk, useUser } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  UserCircle,
  ChevronsUpDown,
} from "lucide-react";

function CompanyNavbarContent() {
  const { signOut, openUserProfile } = useClerk();
  const { user } = useUser();

  const team = useQuery(apiAny.teams.getMyTeam);
  const ensureMyTeam = useMutation(apiAny.teams.ensureMyTeam);

  const subscription = useQuery(apiAny.stripe.getTeamSubscription, team?._id ? { teamId: team._id } : "skip");
  const isPro = subscription?.subscriptionStatus === "active" || subscription?.subscriptionStatus === "trialing";

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
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        {/* Left: Brand / Logo */}
        <Link href="/organisation" className="group flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-transform duration-200 group-hover:scale-105">
            VP
          </span>
          <span className="text-lg font-medium tracking-tight font-[var(--font-display-serif)] text-foreground">
            MyVibe <span className="font-semibold">Planner</span>
          </span>
        </Link>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Right: Actions */}
          <div className="hidden md:flex items-center gap-6 mr-3">
            {!isPro ? (
              <Link
                href="/organisation/subscription"
                className="group relative inline-flex h-8 items-center justify-center overflow-hidden rounded-full bg-black/90 px-4 font-medium text-white shadow-md shadow-blue-600/10 transition-all duration-300 hover:shadow-lg hover:shadow-blue-600/20 hover:scale-[1.01] active:scale-[0.99] border border-white/5 hover:border-blue-500/20"
              >
                <span className="relative z-10 text-xs font-semibold tracking-wide bg-gradient-to-r from-blue-400/90 via-blue-500/90 to-cyan-400/90 bg-clip-text text-transparent">Upgrade</span>
                <span className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-blue-700/10 to-cyan-600/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(37,99,235,0.15)_50%,transparent_75%)] bg-[length:250%_250%] bg-[position:-100%_0] transition-[background-position] duration-[1800ms] group-hover:bg-[position:200%_0]" />
              </Link>
            ) : (
              <Link
                href="/organisation/subscription"
                className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
              >
                Subscription
              </Link>
            )}
            <Link
              href="/organisation/settings"
              className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              Settings
            </Link>
            <Link
              href="/help"
              className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              Help
            </Link>
          </div>

          <Separator
            orientation="vertical"
            className="hidden md:block mx-2 h-5 bg-border/40"
          />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2.5 transition-all duration-200 hover:bg-foreground/[0.04] active:scale-[0.98]"
              >
                <Avatar className="h-8 w-8 ring-1 ring-border/20 transition-all duration-200 group-hover:ring-border/40">
                  <AvatarImage
                    src={user?.imageUrl}
                    alt={user?.fullName || user?.firstName || "User"}
                  />
                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-semibold">
                    {userInitial.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:block max-w-[120px] truncate text-sm font-medium text-foreground/90 group-hover:text-foreground">
                  {user?.firstName || user?.fullName || "Account"}
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-72 rounded-xl border border-border/60 p-1.5 shadow-xl shadow-black/[0.04]"
            >
              <div className="flex items-center gap-3 px-3 py-3">
                <Avatar className="h-10 w-10 ring-1 ring-border/20">
                  <AvatarImage
                    src={user?.imageUrl}
                    alt={user?.fullName || user?.firstName || "User"}
                  />
                  <AvatarFallback className="bg-primary/5 text-primary text-sm font-semibold">
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
              <DropdownMenuSeparator className="mx-1 my-1" />
              <DropdownMenuItem
                onClick={() => openUserProfile?.()}
                className="rounded-lg px-3 py-2.5 gap-3 cursor-pointer"
              >
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                <span>Manage account</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => signOut()}
                className="rounded-lg px-3 py-2.5 gap-3 text-destructive focus:text-destructive cursor-pointer"
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
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-32 bg-muted rounded-md animate-pulse" />
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
