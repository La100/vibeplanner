"use client";
import React, { useEffect, useState } from "react";
import Logo from "./Logo";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SignedIn,
  SignedOut,
  UserButton,
  SignInButton,
  SignUpButton,
} from "@clerk/nextjs";

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const NavItems = () => (
    <>
      <Link
        className="text-sm font-medium hover:underline underline-offset-4"
        href="#features"
      >
        Features
      </Link>
      <Link
        className="text-sm font-medium hover:underline underline-offset-4"
        href="#pricing"
      >
        Pricing
      </Link>
      <Link
        className="text-sm font-medium hover:underline underline-offset-4"
        href="#faqs"
      >
        FAQs
      </Link>
      <SignedIn>
        <Button asChild>
          <Link href="/organization">Dashboard</Link>
        </Button>
        <UserButton />
      </SignedIn>
      <SignedOut>
        <div className="flex items-center gap-4">
          <SignInButton mode="modal">
            <Button variant="outline" className="text-sm">
              Login
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button className="text-sm">
              Get Started
            </Button>
          </SignUpButton>
        </div>
      </SignedOut>
    </>
  );

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 px-8 py-4 z-50 transition-all duration-300",
        isScrolled
          ? "bg-background/60 backdrop-blur-md shadow-xl max-w-[70vw] rounded-full container mx-auto mt-4"
          : "bg-transparent"
      )}
    >
      <header
        className={cn(
          "flex items-center",
          isScrolled ? "rounded-full" : "container mx-auto"
        )}
      >
        <Logo />
        
        {/* Desktop Navigation */}
        <nav className="ml-auto hidden md:flex items-center justify-center gap-6">
          <NavItems />
        </nav>

        {/* Mobile Navigation */}
        <div className="ml-auto md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Menu className="h-6 w-6" strokeWidth={1.5} />
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <nav className="flex flex-col gap-4 mt-12">
                <NavItems />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    </div>
  );
};

export default Navigation; 