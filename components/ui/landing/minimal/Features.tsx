"use client";

import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Set your habit goal",
    description:
      "Pick one outcome and define a realistic routine you can repeat daily.",
  },
  {
    number: "02",
    title: "Connect your tools",
    description:
      "Sync calendar and reminders so AI can coach you in real-world context.",
  },
  {
    number: "03",
    title: "Choose your routine",
    description:
      "Select frequency, preferred time windows, and fallback options.",
  },
  {
    number: "04",
    title: "Start your first check-in",
    description:
      "Open a thread and let VibePlanner guide your next best action.",
  },
];

export function Features() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="font-[var(--font-display-serif)] text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-foreground">
            Up and running in{" "}
            <em className="text-primary not-italic">four steps</em>
          </h2>
          <p className="mt-4 text-muted-foreground text-base max-w-lg mx-auto">
            From sign-up to your first AI-assisted routine in minutes.
          </p>
        </motion.div>

        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4 bg-border rounded-2xl overflow-hidden">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="bg-card p-6 flex flex-col"
            >
              <span className="font-[var(--font-display-serif)] text-3xl text-primary/30 font-normal">
                {step.number}
              </span>
              <h3 className="mt-3 text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
