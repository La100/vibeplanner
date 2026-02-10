"use client";

import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Sparkles, Zap, Shield, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { SignedIn, SignedOut } from "@clerk/nextjs";

const meshBlobs = [
  { color: "#C06A3D", size: 400, top: "-10%", left: "-5%", delay: 0 },
  { color: "#6D8B73", size: 350, top: "20%", right: "-8%", delay: 2 },
  { color: "#7C5CE0", size: 300, top: "60%", left: "10%", delay: 4 },
  { color: "#C4A882", size: 280, top: "-5%", right: "15%", delay: 6 },
];

const floatingBadges = [
  {
    icon: Zap,
    text: "AI-Powered",
    color: "#C06A3D",
    position: "top-[22%] left-[4%] lg:left-[8%]",
    delay: 0.8,
    float: "animate-float-slow",
  },
  {
    icon: Shield,
    text: "94% Success",
    color: "#6D8B73",
    position: "top-[18%] right-[4%] lg:right-[8%]",
    delay: 1.0,
    float: "animate-float-slower",
  },
  {
    icon: TrendingUp,
    text: "10k+ Users",
    color: "#7C5CE0",
    position: "bottom-[32%] left-[2%] lg:left-[6%]",
    delay: 1.2,
    float: "animate-float-slower",
  },
];

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const heroImageY = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const heroImageScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen px-6 pt-28 pb-20 overflow-hidden grain-overlay"
    >
      {/* Mesh gradient blobs */}
      {meshBlobs.map((blob, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-[120px] opacity-[0.15] animate-mesh-float"
          style={{
            width: blob.size,
            height: blob.size,
            backgroundColor: blob.color,
            top: blob.top,
            left: (blob as { left?: string }).left,
            right: (blob as { right?: string }).right,
            animationDelay: `${blob.delay}s`,
          }}
        />
      ))}

      <motion.div style={{ opacity }} className="relative z-10">
        <div className="container mx-auto max-w-6xl text-center">
          {/* Eyebrow badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 backdrop-blur-sm px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground shadow-[0_2px_20px_rgba(0,0,0,0.04)]">
              <Sparkles className="h-3.5 w-3.5 text-[#C06A3D]" />
              AI-Powered Habit Building
            </span>
          </motion.div>

          {/* Headline with animated gradient */}
          <motion.h1
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
            className="mt-10 font-[var(--font-display-serif)] text-[clamp(2.8rem,8vw,7rem)] font-normal tracking-tight leading-[0.92]"
          >
            <span className="text-foreground">Your habits</span>
            <br />
            <span className="text-foreground">deserve a </span>
            <span className="gradient-text-animated">smarter</span>
            <br />
            <span className="text-foreground">companion.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
            className="mx-auto mt-8 max-w-2xl text-lg sm:text-xl text-muted-foreground leading-relaxed"
          >
            Personalized AI assistants that understand your goals, adapt to your
            rhythm, and keep you accountable — so you never build habits alone.
          </motion.p>

          {/* CTA Group */}
          <motion.div
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <SignedOut>
              <Button
                asChild
                size="lg"
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-8 h-14 text-base font-medium shadow-[0_8px_30px_rgba(44,42,37,0.2)] hover:shadow-[0_12px_40px_rgba(44,42,37,0.3)] transition-all duration-300 hover:-translate-y-0.5 animate-glow-pulse"
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
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-8 h-14 text-base font-medium shadow-[0_8px_30px_rgba(44,42,37,0.2)] hover:shadow-[0_12px_40px_rgba(44,42,37,0.3)] transition-all duration-300 hover:-translate-y-0.5 animate-glow-pulse"
              >
                <Link href="/organisation">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </SignedIn>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full border-border/60 bg-card/50 backdrop-blur-sm px-8 h-14 text-base font-medium hover:bg-card/80 transition-all duration-300"
            >
              <Link href="#ai-assistants">Meet the AI Team</Link>
            </Button>
          </motion.div>

          {/* Trust signals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-8 flex items-center justify-center gap-8 text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#6D8B73]" />
              Free forever
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C06A3D]" />
              No credit card
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7C5CE0]" />
              10,000+ habits built
            </span>
          </motion.div>

          {/* Floating badges - hidden on mobile */}
          {floatingBadges.map((badge, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: badge.delay }}
              className={`absolute hidden lg:flex items-center gap-2 rounded-full border border-border/40 bg-card/90 backdrop-blur-md px-4 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ${badge.position} ${badge.float}`}
            >
              <badge.icon
                className="h-3.5 w-3.5"
                style={{ color: badge.color }}
              />
              <span className="text-xs font-medium text-foreground">
                {badge.text}
              </span>
            </motion.div>
          ))}

          {/* Hero Visual with parallax */}
          <motion.div
            style={{ y: heroImageY, scale: heroImageScale }}
            className="mx-auto mt-20 max-w-5xl"
          >
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 1,
                delay: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative rounded-[24px] border border-border/50 bg-card shadow-[0_60px_120px_rgba(0,0,0,0.12),0_0_0_1px_rgba(255,255,255,0.1)_inset] overflow-hidden"
            >
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/30 bg-card/80">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-[#FF5F56]" />
                  <div className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                  <div className="h-3 w-3 rounded-full bg-[#27C93F]" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-4 py-1">
                    <span className="text-[10px] text-muted-foreground">
                      vibeplanner.app
                    </span>
                  </div>
                </div>
              </div>

              {/* Screenshot area */}
              <div className="aspect-[16/9] bg-muted">
                <img
                  src="/placeholder-hero-demo.png"
                  alt="VibePlanner AI habit building dashboard"
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
