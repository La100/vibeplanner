"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send } from "lucide-react";
import { useState } from "react";

const assistants = [
  {
    name: "Atlas",
    specialty: "Accountability Coach",
    color: "#C06A3D",
    initials: "AT",
    tagline: "Your daily accountability partner",
    description:
      "Keeps you on track with daily check-ins, progress reviews, and gentle but firm reminders when you're slipping.",
    conversation: [
      { role: "assistant" as const, text: "Good morning! I see you've been crushing your morning runs. 12 days straight!" },
      { role: "user" as const, text: "Thanks Atlas! I almost skipped today though..." },
      { role: "assistant" as const, text: "But you didn't. That's what matters. Your consistency on tough days is what builds real habits. Ready to push for 15 days?" },
    ],
  },
  {
    name: "Sage",
    specialty: "Wellness Guide",
    color: "#6D8B73",
    initials: "SG",
    tagline: "Holistic health & mindfulness",
    description:
      "Focuses on health, sleep, nutrition, and mindfulness habits with a calming, holistic approach.",
    conversation: [
      { role: "assistant" as const, text: "I noticed your sleep has been shifting later this week. How are you feeling?" },
      { role: "user" as const, text: "Honestly, pretty tired. I keep scrolling before bed." },
      { role: "assistant" as const, text: "Let's adjust your wind-down routine. I'll send you a gentle reminder at 10pm to start your evening ritual. Small shift, big impact." },
    ],
  },
  {
    name: "Nova",
    specialty: "Productivity Master",
    color: "#002FA7",
    initials: "NV",
    tagline: "Deep work & time mastery",
    description:
      "Optimizes your work habits, deep focus sessions, and time management routines with data-driven insights.",
    conversation: [
      { role: "assistant" as const, text: "Your deep work sessions are 23% longer on Tuesdays. Interesting pattern." },
      { role: "user" as const, text: "Really? I had no idea. What should I do with that?" },
      { role: "assistant" as const, text: "Let's schedule your most demanding tasks for Tuesdays. I'll block 3 hours of focus time and guard it from meetings." },
    ],
  },
  {
    name: "Luna",
    specialty: "Mindfulness Mentor",
    color: "#7C5CE0",
    initials: "LN",
    tagline: "Meditation & self-awareness",
    description:
      "Guides meditation, journaling, gratitude, and emotional awareness habits with gentle wisdom.",
    conversation: [
      { role: "assistant" as const, text: "You've journaled 5 days straight. I'm noticing more self-reflection in your entries." },
      { role: "user" as const, text: "I didn't think anyone would notice that 😊" },
      { role: "assistant" as const, text: "Growth happens in the quiet moments. Your awareness is expanding beautifully. Want to try a gratitude prompt today?" },
    ],
  },
];

export function AIAssistantsShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = assistants[activeIndex];

  return (
    <section id="ai-assistants" className="py-28 px-6 relative overflow-hidden">
      {/* Subtle bg accent */}
      <div
        className="absolute inset-0 opacity-[0.03] transition-colors duration-700"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, ${active.color} 0%, transparent 70%)`,
        }}
      />

      <div className="relative container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 backdrop-blur-sm px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Meet Your AI Team
          </span>
          <h2 className="mt-6 font-[var(--font-display-serif)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight text-foreground leading-tight">
            Assistants that actually
            <br />
            <span className="gradient-text-animated">understand</span> you.
          </h2>
          <p className="mt-5 text-muted-foreground text-lg max-w-xl mx-auto">
            Each AI assistant is a specialist trained to help you in specific
            areas. They learn your patterns and adapt to you.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-8">
          {/* Selector cards */}
          <div className="flex flex-col gap-3">
            {assistants.map((assistant, index) => (
              <motion.button
                key={assistant.name}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                onClick={() => setActiveIndex(index)}
                className={`group flex items-center gap-4 rounded-2xl border p-5 text-left transition-all duration-300 ${
                  activeIndex === index
                    ? "border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.08)] -translate-x-1"
                    : "border-transparent hover:border-border/50 hover:bg-card/50"
                }`}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white text-sm font-semibold transition-all duration-300"
                  style={{
                    backgroundColor:
                      activeIndex === index
                        ? assistant.color
                        : `${assistant.color}30`,
                    color:
                      activeIndex === index ? "white" : assistant.color,
                  }}
                >
                  {assistant.initials}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-foreground">
                      {assistant.name}
                    </span>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${assistant.color}15`,
                        color: assistant.color,
                      }}
                    >
                      {assistant.specialty}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">
                    {assistant.tagline}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Interactive chat preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-[24px] border border-border/50 bg-card shadow-[0_40px_80px_rgba(0,0,0,0.08)] overflow-hidden"
          >
            {/* Chat header */}
            <div
              className="flex items-center gap-3 px-6 py-4 border-b border-border/30 transition-colors duration-500"
              style={{ backgroundColor: `${active.color}08` }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-white text-xs font-semibold"
                style={{ backgroundColor: active.color }}
              >
                {active.initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {active.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {active.specialty} · Online
                </p>
              </div>
              <div
                className="ml-auto h-2 w-2 rounded-full animate-pulse"
                style={{ backgroundColor: active.color }}
              />
            </div>

            {/* Chat messages */}
            <div className="p-6 min-h-[320px] flex flex-col justify-end gap-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-3"
                >
                  {active.conversation.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.15 }}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-secondary/70 text-foreground rounded-bl-md"
                        }`}
                      >
                        {msg.role === "assistant" && (
                          <Bot
                            className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5"
                            style={{ color: active.color }}
                          />
                        )}
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Chat input */}
            <div className="px-6 pb-5">
              <div className="flex items-center gap-3 rounded-full border border-border/50 bg-muted/30 px-5 py-3">
                <span className="text-sm text-muted-foreground flex-1">
                  Ask {active.name} anything...
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: active.color }}
                >
                  <Send className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
