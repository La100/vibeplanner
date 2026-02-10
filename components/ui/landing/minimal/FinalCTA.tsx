"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";

const meshBlobs = [
  { color: "#C06A3D", size: 300, top: "10%", left: "-5%", delay: 0 },
  { color: "#6D8B73", size: 250, top: "60%", right: "-5%", delay: 3 },
  { color: "#7C5CE0", size: 200, top: "20%", right: "20%", delay: 5 },
];

export function FinalCTA() {
  return (
    <section className="relative py-32 px-6 overflow-hidden grain-overlay">
      {/* Mesh gradient blobs */}
      {meshBlobs.map((blob, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-[100px] opacity-[0.12] animate-mesh-float"
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

      <div className="relative z-10 container mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <Sparkles className="h-8 w-8 mx-auto text-[#C06A3D] mb-6" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="font-[var(--font-display-serif)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal tracking-tight text-foreground leading-[0.92]"
        >
          Your best habits
          <br />
          are <span className="gradient-text-animated">waiting</span>.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-8 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          Join 10,000+ people who are building lasting habits with AI assistants
          that never give up on them.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <SignedOut>
            <Button
              asChild
              size="lg"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-10 h-14 text-base font-medium shadow-[0_8px_30px_rgba(44,42,37,0.2)] hover:shadow-[0_16px_50px_rgba(44,42,37,0.25)] transition-all duration-300 hover:-translate-y-0.5 animate-glow-pulse"
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
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-10 h-14 text-base font-medium shadow-[0_8px_30px_rgba(44,42,37,0.2)] hover:shadow-[0_16px_50px_rgba(44,42,37,0.25)] transition-all duration-300 hover:-translate-y-0.5 animate-glow-pulse"
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

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 text-xs text-muted-foreground"
        >
          No credit card required. Free plan available forever.
        </motion.p>
      </div>
    </section>
  );
}
