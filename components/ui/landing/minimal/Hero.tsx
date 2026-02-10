"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";

const decorativeDots = [
  { color: "#C4A882", size: 14, top: "18%", left: "16%", delay: 0.3 },
  { color: "#A68B6B", size: 10, top: "12%", left: "22%", delay: 0.4 },
  { color: "#B8C4D4", size: 12, top: "15%", left: "18%", delay: 0.5 },
  { color: "#002FA7", size: 10, top: "68%", right: "14%", delay: 0.6 },
  { color: "#D4B8A0", size: 16, top: "22%", right: "20%", delay: 0.35 },
  { color: "#A0B8A8", size: 8, top: "60%", left: "10%", delay: 0.55 },
];

export function Hero() {
  return (
    <section className="relative px-6 pt-32 pb-24 overflow-hidden">
      {/* Decorative dots */}
      {decorativeDots.map((dot, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: dot.size,
            height: dot.size,
            backgroundColor: dot.color,
            top: dot.top,
            left: dot.left,
            right: (dot as { right?: string }).right,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.7, scale: 1 }}
          transition={{ duration: 0.6, delay: dot.delay, ease: "easeOut" }}
        />
      ))}

      <div className="container mx-auto max-w-5xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="font-[var(--font-display-serif)] text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-normal tracking-tight text-foreground leading-[0.95]"
        >
          Build your next{" "}
          <br className="hidden sm:block" />
          <em className="text-primary not-italic font-[var(--font-display-serif)]">
            habit
          </em>{" "}
          with
          <br className="hidden sm:block" />
          confidence.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="mx-auto mt-8 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed"
        >
          VibePlanner brings AI-powered habit coaching into your day,
          turning goals into repeatable routines in minutes.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
          className="mx-auto mt-10 flex max-w-lg items-center gap-0 rounded-full border border-border bg-card shadow-sm overflow-hidden"
        >
          <div className="flex flex-1 items-center gap-3 px-5 py-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">
              Start your first habit...
            </span>
          </div>
          <Button
            asChild
            size="lg"
            className="h-full rounded-none rounded-r-full px-7 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/sign-up">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground"
        >
          <span>Free to start</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>No credit card required</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <Link
            href="/help"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            View demo
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
