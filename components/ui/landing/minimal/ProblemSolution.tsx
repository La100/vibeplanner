"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { CircleAlert, Copy, ShieldAlert, ArrowDown } from "lucide-react";
import { useRef } from "react";

const painPoints = [
  { icon: CircleAlert, text: "No personalized guidance", color: "#C06A3D" },
  { icon: ShieldAlert, text: "Zero accountability", color: "#C06A3D" },
  { icon: Copy, text: "One-size-fits-all approaches", color: "#C06A3D" },
];

export function ProblemSolution() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const lineHeight = useTransform(scrollYProgress, [0.1, 0.5], ["0%", "100%"]);

  return (
    <section ref={sectionRef} className="py-28 px-6 relative">
      <div className="container mx-auto max-w-6xl">
        {/* Problem */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#C06A3D]/20 bg-[#C06A3D]/5 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-[#C06A3D]">
            The Habit Crisis
          </span>

          <h2 className="mt-8 font-[var(--font-display-serif)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal tracking-tight text-foreground leading-[0.95]">
            <span className="gradient-text">92%</span> of people
            <br />
            fail at building
            <br />
            new habits.
          </h2>

          <p className="mt-8 text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Willpower fades. Motivation is unreliable. Generic apps treat
            everyone the same. Without personalized guidance, most habits die
            within two weeks.
          </p>

          {/* Pain points */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {painPoints.map((point, index) => (
              <motion.div
                key={point.text}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                className="flex items-center gap-2.5 rounded-full border border-border/50 bg-card/80 backdrop-blur-sm px-5 py-2.5"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C06A3D]/10">
                  <point.icon className="h-3.5 w-3.5 text-[#C06A3D]" />
                </span>
                <span className="text-sm text-foreground">{point.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Connecting arrow */}
        <div className="flex flex-col items-center my-16">
          <motion.div
            className="w-px bg-gradient-to-b from-border to-[#6D8B73] overflow-hidden"
            style={{ height: 80 }}
          >
            <motion.div
              className="w-full bg-[#6D8B73]"
              style={{ height: lineHeight }}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#6D8B73] shadow-[0_8px_20px_rgba(109,139,115,0.3)]"
          >
            <ArrowDown className="h-4 w-4 text-white" />
          </motion.div>
        </div>

        {/* Solution */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#6D8B73]/20 bg-[#6D8B73]/5 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-[#6D8B73]">
            The Solution
          </span>

          <h2 className="mt-8 font-[var(--font-display-serif)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal tracking-tight text-foreground leading-[0.95]">
            VibePlanner
            <br />
            <span className="gradient-text-animated">changes</span> everything.
          </h2>

          <p className="mt-8 text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            AI assistants that learn your patterns, adapt to your schedule, and
            provide the exact nudge at the right moment. A personal coach that
            never gives up on you.
          </p>

          {/* Solution app screenshot */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12 rounded-[24px] border border-border/50 bg-card shadow-[0_40px_80px_rgba(0,0,0,0.08)] overflow-hidden max-w-4xl mx-auto"
          >
            <div className="aspect-[16/9] bg-muted">
              <img
                src="/placeholder-solution.png"
                alt="VibePlanner AI coaching interface"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
