"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const steps = [
  {
    number: "01",
    title: "Tell us your goals",
    description:
      "Share what habits you want to build. Our AI analyzes your lifestyle, schedule, and preferences to create a personalized plan.",
    image: "/placeholder-step-1.png",
    imageAlt: "VibePlanner goal setting interface",
    color: "#C06A3D",
  },
  {
    number: "02",
    title: "Meet your AI assistant",
    description:
      "Get matched with specialized AI assistants who understand your specific habit goals and coaching style preferences.",
    image: "/placeholder-step-2.png",
    imageAlt: "VibePlanner AI assistant selection",
    color: "#6D8B73",
  },
  {
    number: "03",
    title: "Build, track, succeed",
    description:
      "Follow your personalized routine with daily AI guidance, smart reminders, and streak tracking that keeps you motivated.",
    image: "/placeholder-step-3.png",
    imageAlt: "VibePlanner habit tracking dashboard",
    color: "#7C5CE0",
  },
];

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const lineProgress = useTransform(scrollYProgress, [0.15, 0.85], ["0%", "100%"]);

  return (
    <section ref={containerRef} className="py-28 px-6 relative overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(196,168,130,0.06)_0%,transparent_50%)]" />

      <div className="relative container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 backdrop-blur-sm px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Simple Start
          </span>
          <h2 className="mt-6 font-[var(--font-display-serif)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight text-foreground leading-tight">
            Three steps to
            <br />
            <span className="gradient-text-animated">better habits</span>.
          </h2>
        </motion.div>

        {/* Steps with connecting line */}
        <div className="relative">
          {/* Vertical progress line - hidden on mobile */}
          <div className="absolute left-[28px] lg:left-1/2 lg:-translate-x-px top-0 bottom-0 w-0.5 bg-border/30 hidden md:block">
            <motion.div
              className="w-full bg-gradient-to-b from-[#C06A3D] via-[#6D8B73] to-[#7C5CE0]"
              style={{ height: lineProgress }}
            />
          </div>

          <div className="flex flex-col gap-20 md:gap-28">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
                  index % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                }`}
              >
                {/* Content side */}
                <motion.div
                  initial={{
                    opacity: 0,
                    x: index % 2 === 0 ? -40 : 40,
                  }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.7,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={index % 2 === 0 ? "lg:text-right" : "lg:text-left"}
                >
                  {/* Step number */}
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                      delay: 0.1,
                    }}
                    className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white text-lg font-semibold shadow-lg`}
                    style={{
                      backgroundColor: step.color,
                      boxShadow: `0 8px 25px ${step.color}30`,
                    }}
                  >
                    {step.number}
                  </motion.div>

                  <h3 className="mt-6 font-[var(--font-display-serif)] text-2xl sm:text-3xl font-medium text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-4 text-base text-muted-foreground leading-relaxed max-w-md">
                    {step.description}
                  </p>
                </motion.div>

                {/* Image side */}
                <motion.div
                  initial={{
                    opacity: 0,
                    x: index % 2 === 0 ? 40 : -40,
                    scale: 0.95,
                  }}
                  whileInView={{ opacity: 1, x: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.7,
                    delay: 0.15,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="group"
                >
                  <div
                    className="rounded-[20px] border border-border/50 bg-card overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.06)] transition-all duration-500 group-hover:shadow-[0_30px_60px_rgba(0,0,0,0.1)] group-hover:-translate-y-1"
                  >
                    <div className="aspect-[4/3] bg-muted">
                      <img
                        src={step.image}
                        alt={step.imageAlt}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
