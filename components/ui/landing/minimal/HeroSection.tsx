"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export function HeroSection() {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] px-6 pt-24 pb-20 flex items-center justify-center">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-[var(--font-display-serif)] text-[clamp(2.5rem,7vw,5.5rem)] font-normal tracking-tight leading-[0.95]">
          <span className="text-foreground">Your habits</span>
          <br />
          <span className="text-foreground">deserve a </span>
          <span className="text-foreground/70">smarter</span>
          <br />
          <span className="text-foreground">companion.</span>
        </h1>

        <p className="mx-auto mt-8 max-w-xl text-lg text-muted-foreground leading-relaxed">
          Personalized AI assistants that understand your goals, adapt to your
          rhythm, and keep you accountable — so you never build habits alone.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <SignedOut>
            <Button
              asChild
              size="lg"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-8 h-14 text-base font-medium"
            >
              <Link href="/sign-up">
                Start Building Habits — Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </SignedOut>
          <SignedIn>
            <Button
              asChild
              size="lg"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-8 h-14 text-base font-medium"
            >
              <Link href="/organisation">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </SignedIn>
        </div>

        <div className="mt-8 flex items-center justify-center gap-8 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Free forever
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            No credit card
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            10,000+ habits built
          </span>
        </div>
      </div>
    </section>
  );
}
