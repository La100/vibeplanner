"use client";
import React, { useEffect, useState } from "react";
import Logo from "./Logo";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQs", href: "#faqs" },
];

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const NavItems = ({ className }: { className?: string }) => (
    <div className={cn("flex items-center gap-7", className)}>
      {navLinks.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className="text-sm font-medium text-[#5A5752] transition-colors duration-200 hover:text-[#1A1A1A]"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );

  return (
    <div
      className={cn(
        "sticky top-0 z-40 border-b border-[#E7E2D9]/70 backdrop-blur-sm transition-all duration-300",
        isScrolled ? "bg-[#FAF7F2]/92 shadow-sm" : "bg-[#FAF7F2]"
      )}
    >
      <header className="mx-auto flex h-20 max-w-6xl items-center gap-6 px-6 sm:px-8">
        <Logo />

        <nav className="ml-auto hidden items-center gap-8 md:flex">
          <NavItems />

          <SignedIn>
            <div className="flex items-center gap-3 pl-4">
              <Button
                asChild
                variant="ghost"
                className="rounded-full border border-transparent px-5 py-2 text-sm font-medium text-[#1A1A1A] hover:bg-[#F2EEE6]"
              >
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <UserButton appearance={{ elements: { userButtonAvatarBox: "rounded-full border border-[#E7E2D9]" } }} />
            </div>
          </SignedIn>
          <SignedOut>
            <div className="flex items-center gap-3 pl-4">
              <Link
                href="/contact"
                className="rounded-full border border-[#E7E2D9] bg-white px-5 py-2 text-sm font-medium text-[#1A1A1A] transition-colors duration-200 hover:bg-[#F2EEE6]"
              >
                Contact sales
              </Link>
              <Button asChild className="rounded-full border border-[#1A1A1A] bg-[#1A1A1A] px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(12,12,12,0.16)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#0E0E0E]">
                <Link href="/sign-up">Try VibePlanner</Link>
              </Button>
            </div>
          </SignedOut>
        </nav>

        <div className="ml-auto flex items-center md:hidden">
          <SignedIn>
            <div className="flex items-center gap-3">
              <Button
                asChild
                variant="ghost"
                className="rounded-full border border-transparent px-5 py-2 text-sm font-medium text-[#1A1A1A] hover:bg-[#F2EEE6]"
              >
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <UserButton appearance={{ elements: { userButtonAvatarBox: "rounded-full border border-[#E7E2D9]" } }} />
            </div>
          </SignedIn>
          <SignedOut>
            <div className="flex items-center gap-3">
              <Button
                asChild
                variant="ghost"
                className="rounded-full px-5 py-2 text-sm font-medium text-[#5A5752] hover:text-[#1A1A1A]"
              >
                <Link href="/sign-in">Log in</Link>
              </Button>
              <Button
                asChild
                className="rounded-full border border-[#1A1A1A] bg-[#1A1A1A] px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(12,12,12,0.16)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#0E0E0E]"
              >
                <Link href="/sign-up">Start free</Link>
              </Button>
            </div>
          </SignedOut>
        </div>

        <div className="ml-3 flex items-center md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E7E2D9] bg-white text-foreground"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </SheetTrigger>
            <SheetContent side="top" className="border-none bg-[#FAF7F2] px-6">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="my-6 flex flex-col gap-6">
                <NavItems className="flex-wrap justify-start gap-4" />
                <SignedIn>
                  <div className="flex items-center gap-4">
                    <Button
                      asChild
                      className="rounded-full border border-[#E7E2D9] bg-white px-6 py-3 text-sm font-medium text-foreground shadow-sm"
                    >
                      <Link href="/dashboard">Dashboard</Link>
                    </Button>
                    <UserButton />
                  </div>
                </SignedIn>
                <SignedOut>
                  <div className="flex flex-col gap-3">
                    <Link
                      href="/contact"
                      className="rounded-full border border-[#E7E2D9] bg-white px-6 py-3 text-sm font-medium text-[#1A1A1A] text-center transition-colors duration-200 hover:bg-[#F2EEE6]"
                    >
                      Contact sales
                    </Link>
                    <Button
                      asChild
                      className="rounded-full bg-[#0E0E0E] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(12,12,12,0.18)]"
                    >
                      <Link href="/sign-up">Try VibePlanner</Link>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      className="rounded-full px-6 py-3 text-sm font-medium text-[#5A5752] hover:text-foreground"
                    >
                      <Link href="/sign-in">Log in</Link>
                    </Button>
                  </div>
                </SignedOut>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    </div>
  );
};

export default Navigation;
