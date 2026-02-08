"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Logo from "../Logo";

export function Navbar() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 50);
  });

  return (
    <motion.header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between px-6 transition-all duration-300 sm:px-10",
        isScrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border/40"
          : "bg-transparent"
      )}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
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
          <nav className="hidden sm:flex items-center gap-1 mr-2">
            <Link
              href="#ai-assistants"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              AI Assistants
            </Link>
            <Link
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              Pricing
            </Link>
            <Link
              href="#faq"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              FAQ
            </Link>
          </nav>
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
    </motion.header>
  );
}
