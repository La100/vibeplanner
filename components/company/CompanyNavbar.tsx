"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useClerk, useUser } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  Menu,
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
    <nav className="border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        {/* Left: Brand / Logo */}
        <Link href="/organisation" className="group flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            VP
          </span>
          <span className="text-lg font-medium tracking-tight font-[var(--font-display-serif)] text-foreground">
            MyVibe <span className="font-semibold">Planner</span>
          </span>
        </Link>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <div className="mr-3 hidden items-center gap-3 md:flex">
            {!isPro ? (
              <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/organisation/subscription">Upgrade</Link>
              </Button>
            ) : (
              <Link
                href="/organisation/subscription"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Subscription
              </Link>
            )}
            <Link
              href="/organisation/settings"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Settings
            </Link>
            <Link
              href="/help"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Help
            </Link>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open organization navigation"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card/85 text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-card md:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-xs border-l border-border/60 bg-background px-5 pt-11 pb-6">
              <SheetTitle className="sr-only">Organization navigation</SheetTitle>
              <div className="flex flex-col gap-3">
                {!isPro ? (
                  <SheetClose asChild>
                    <Button asChild className="h-11 rounded-full">
                      <Link href="/organisation/subscription">Upgrade plan</Link>
                    </Button>
                  </SheetClose>
                ) : (
                  <SheetClose asChild>
                    <Link
                      href="/organisation/subscription"
                      className="rounded-2xl border border-border/50 bg-card/70 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card"
                    >
                      Subscription
                    </Link>
                  </SheetClose>
                )}
                <SheetClose asChild>
                  <Link
                    href="/organisation/settings"
                    className="rounded-2xl border border-border/50 bg-card/70 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card"
                  >
                    Settings
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href="/help"
                    className="rounded-2xl border border-border/50 bg-card/70 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card"
                  >
                    Help
                  </Link>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>

          <Separator
            orientation="vertical"
            className="hidden md:block mx-2 h-5 bg-border/40"
          />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-2.5 transition-all duration-200 hover:bg-foreground/[0.04] active:scale-[0.98]"
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
              className="w-72 rounded-2xl border border-border/60 p-1.5 shadow-xl shadow-black/[0.04]"
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
    </nav>
  );
}

function NavbarSkeleton() {
  return (
    <nav className="border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-32 bg-muted rounded-md animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted/60 animate-pulse" />
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
