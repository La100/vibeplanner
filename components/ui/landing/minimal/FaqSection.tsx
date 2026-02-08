"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How do the AI assistants actually work?",
    answer:
      "Our AI assistants are powered by advanced language models fine-tuned for habit coaching. They analyze your habit data, completion patterns, and preferences to provide personalized guidance. They learn from your interactions and adapt their coaching style over time.",
  },
  {
    question: "Is my data private and secure?",
    answer:
      "Absolutely. Your habit data is encrypted end-to-end. We never sell your data to third parties. Our AI processes your information only to provide personalized coaching, and you can delete your data at any time.",
  },
  {
    question: "Can I switch AI assistants or use multiple at once?",
    answer:
      "On the Pro plan, you get access to all four AI assistants simultaneously. Each specializes in different areas, so they work together to support your complete habit-building journey. You can also adjust their coaching intensity.",
  },
  {
    question: "What happens if I miss a habit?",
    answer:
      "No judgment here. Your AI assistant will check in with you, understand why you missed, and help you adjust your plan. VibePlanner is designed to be compassionate — we focus on building resilience, not guilt.",
  },
  {
    question: "Does VibePlanner work for teams?",
    answer:
      "Yes! Our Team plan is designed for groups who want shared accountability. Teams can create joint habits, run challenges, and track collective progress. Many workplace wellness programs use VibePlanner for team health initiatives.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, you can cancel your subscription at any time. Your data remains accessible for 30 days after cancellation, and you can always re-subscribe to pick up where you left off.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="py-28 px-6 relative">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(124,92,224,0.04)_0%,transparent_60%)]" />

      <div className="relative container mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 backdrop-blur-sm px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Questions & Answers
          </span>
          <h2 className="mt-6 font-[var(--font-display-serif)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight text-foreground leading-tight">
            Everything you
            <br />
            want to <span className="gradient-text-animated">know</span>.
          </h2>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, index) => (
            <motion.div
              key={faq.question}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: index * 0.06,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <AccordionItem
                value={`faq-${index}`}
                className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm px-6 overflow-hidden transition-all duration-300 hover:border-border hover:shadow-[0_8px_25px_rgba(0,0,0,0.04)] data-[state=open]:shadow-[0_12px_30px_rgba(0,0,0,0.06)] data-[state=open]:border-border"
              >
                <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
