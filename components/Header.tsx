"use client";

import {
  SignedIn,
  SignedOut,
  OrganizationSwitcher,
  UserButton,
  SignInButton,
  SignUpButton,
} from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-background border-b p-4 flex flex-row justify-between items-center shadow-sm">
      <Link href="/" className="flex items-center gap-3 cursor-pointer">
        <Building2 className="h-8 w-8 text-primary" />
        <div className="flex flex-col">
          <h1 className="text-xl font-bold">VibePlanner</h1>
          <Badge variant="secondary" className="w-fit">
            Architectural Project Manager
          </Badge>
        </div>
      </Link>
      <div className="flex items-center gap-4">
        <SignedIn>
          <OrganizationSwitcher
            hidePersonal
            hideSlug
            afterSelectOrganizationUrl="/:slug"
            afterCreateOrganizationUrl="/:slug"
            skipInvitationScreen={true}
          />
          <UserButton />
        </SignedIn>
        <SignedOut>
          <div className="flex gap-2">
            <SignInButton mode="modal">
              <Button variant="default">Log In</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button variant="outline">Sign Up</Button>
            </SignUpButton>
          </div>
        </SignedOut>
      </div>
    </header>
  );
}

