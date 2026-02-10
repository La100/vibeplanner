"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Logo from "../Logo";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "py-2 px-4 sm:px-8"
          : ""
      }`}
    >
      <div
        className={`mx-auto flex h-12 items-center justify-between px-6 transition-all duration-300 ${
          scrolled
            ? "max-w-4xl rounded-full border border-border/30 bg-background/60 backdrop-blur-xl shadow-lg shadow-black/[0.04]"
            : "max-w-[1440px] bg-background/80 backdrop-blur-md sm:px-10"
        }`}
      >
        <Logo />

        <div className="flex items-center gap-3">
          <SignedIn>
            <Button
              variant="ghost"
              asChild
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Link href="/organisation">Dashboard</Link>
            </Button>
            <UserButton
              appearance={{
                elements: { userButtonAvatarBox: "rounded-full" },
              }}
            />
          </SignedIn>
          <SignedOut>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-border text-sm font-medium px-5 h-9"
            >
              <Link href="/sign-in">Log in</Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-5 h-9 text-sm font-medium"
            >
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}
