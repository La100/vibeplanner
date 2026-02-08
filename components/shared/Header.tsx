"use client";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-background border-b p-4 flex flex-row justify-between items-center shadow-sm">
      <Link href="/organisation" className="flex items-center gap-3 cursor-pointer">
        <Building2 className="h-8 w-8 text-primary" />
        <div className="flex flex-col">
          <h1 className="text-xl font-bold">VibePlanner</h1>
          <Badge variant="secondary" className="w-fit">
            AI Assistant Workspace
          </Badge>
        </div>
      </Link>
      <div className="flex items-center gap-4">
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <div className="flex gap-2">
            <Button asChild variant="default">
              <Link href="/sign-in">Log In</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-up">Sign Up</Link>
            </Button>
          </div>
        </SignedOut>
      </div>
    </header>
  );
}
