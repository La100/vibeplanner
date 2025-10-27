"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { ArrowRight, BarChart3, CalendarClock, Compass, LayoutDashboard, Sparkles } from "lucide-react";

const features = [
  {
    title: "Predictive AI rituals",
    description:
      "Surface the right questions ahead of every planning ceremony. VibePlanner analyses recent activity, blockers, and priorities so you start every call aligned.",
    icon: Sparkles,
    tag: "Ritual intelligence",
  },
  {
    title: "Shared operating rhythm",
    description:
      "Design weekly, monthly, and quarterly cadences once. Teams inherit the templates, while leadership keeps a clear line of sight across every initiative.",
    icon: CalendarClock,
    tag: "Cadence templates",
  },
  {
    title: "Cohesive project rooms",
    description:
      "Docs, tasks, owners, and review history live in a beautifully calm space. Everything you need for a decision is collected automatically.",
    icon: LayoutDashboard,
    tag: "Context in one place",
  },
  {
    title: "Signals before red flags",
    description:
      "Trend analysis spots slipping milestones and overloaded contributors before they break your schedule. Intervene early with confidence.",
    icon: BarChart3,
    tag: "Early visibility",
  },
  {
    title: "Stakeholder-ready stories",
    description:
      "Generate polished updates tailored to the audience. From investor snapshots to cross-functional digests, your narrative writes itself.",
    icon: ArrowRight,
    tag: "Narrative automation",
  },
  {
    title: "Playbooks for every team",
    description:
      "Product, marketing, ops, and revenue teams each get dedicated best-practice boards while leadership keeps a unified view of strategic work.",
    icon: Compass,
    tag: "Teams in harmony",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="bg-white py-24 sm:py-32">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 sm:px-8">
        <div className="max-w-2xl space-y-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#E7E2D9] bg-[#FAF7F2] px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-[#6D8B73]">
            Why teams stay with VibePlanner
          </span>
          <h2 className="text-4xl font-medium leading-tight text-foreground sm:text-[2.75rem] font-[var(--font-display-serif)]">
            Every layer of execution held together in one calm rhythm.
          </h2>
          <p className="text-lg leading-relaxed text-[#3C3A37] sm:text-xl">
            VibePlanner removes the noise from modern project leadership. Ritual templates align teams, AI scans for risk, and progress narratives write themselves so you can focus on the work that matters.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group relative overflow-hidden rounded-[24px] border border-[#E7E2D9] bg-white p-7 shadow-none transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(20,20,20,0.08)]"
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-[#E7E2D9] bg-[#FAF7F2] text-[#C06A3D]">
                <feature.icon className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <span className="text-xs uppercase tracking-[0.24em] text-[#8C8880]">{feature.tag}</span>
              <h3 className="mt-3 text-2xl font-medium text-foreground font-[var(--font-display-serif)]">{feature.title}</h3>
              <p className="mt-4 text-base leading-relaxed text-[#3C3A37]">
                {feature.description}
              </p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#1A1A1A]/80">
                Learn more
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
