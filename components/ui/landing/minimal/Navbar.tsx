"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Logo from "../Logo"; // Assuming Logo is reusable

export function Navbar() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 50);
  });

  return (
    <motion.header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex h-20 items-center justify-between px-6 transition-all duration-300 sm:px-12",
        isScrolled ? "bg-background/80 backdrop-blur-md border-b border-border/40" : "bg-transparent"
      )}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-8">
        <Logo />
        
        <nav className="hidden md:flex items-center gap-6">
          <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Features
          </Link>
          <Link href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <SignedIn>
          <Button variant="ghost" asChild className="rounded-full">
            <Link href="/organization">Dashboard</Link>
          </Button>
          <UserButton appearance={{ elements: { userButtonAvatarBox: "rounded-full" } }} />
        </SignedIn>
        <SignedOut>
          <Button asChild variant="ghost" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            <Link href="/sign-in">Log in</Link>
          </Button>
          <Button asChild className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-6">
            <Link href="/sign-up">Get Started</Link>
          </Button>
        </SignedOut>
      </div>
    </motion.header>
  );
}
