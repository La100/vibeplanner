"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Flame,
  Target,
  Bot,
  Star,
  Trophy,
  Heart,
  Zap,
  Users,
} from "lucide-react";

function CountUp({
  target,
  suffix = "",
  decimals = 0,
  duration = 2000,
}: {
  target: number;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, target, duration]);

  return (
    <span ref={ref}>
      {decimals > 0 ? count.toFixed(decimals) : Math.round(count).toLocaleString()}
      {suffix}
    </span>
  );
}

const stats = [
  {
    target: 10000,
    suffix: "+",
    label: "Habits Built",
    icon: Flame,
    color: "#C06A3D",
  },
  {
    target: 94,
    suffix: "%",
    label: "Success Rate",
    icon: Target,
    color: "#6D8B73",
  },
  {
    target: 150,
    suffix: "+",
    label: "AI Assistants",
    icon: Bot,
    color: "#002FA7",
  },
  {
    target: 4.9,
    suffix: "/5",
    label: "User Rating",
    icon: Star,
    color: "#7C5CE0",
    decimals: 1,
  },
];

const marqueeItems = [
  { icon: Trophy, text: "12-day morning run streak", color: "#C06A3D" },
  { icon: Heart, text: "Meditation habit unlocked", color: "#7C5CE0" },
  { icon: Zap, text: "Deep work session completed", color: "#002FA7" },
  { icon: Users, text: "Team challenge: 7-day journaling", color: "#6D8B73" },
  { icon: Flame, text: "90-day streak achieved!", color: "#C06A3D" },
  { icon: Star, text: "New personal best: 45min focus", color: "#7C5CE0" },
  { icon: Target, text: "Weekly review completed", color: "#002FA7" },
  { icon: Heart, text: "Gratitude habit: 30 days", color: "#6D8B73" },
];

export function SocialProofBar() {
  return (
    <section className="py-20 px-6 overflow-hidden">
      <div className="container mx-auto max-w-6xl">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.06)]"
            >
              <div
                className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${stat.color}12` }}
              >
                <stat.icon
                  className="h-5 w-5"
                  style={{ color: stat.color }}
                />
              </div>
              <div className="font-[var(--font-display-serif)] text-3xl md:text-4xl font-normal text-foreground">
                <CountUp
                  target={stat.target}
                  suffix={stat.suffix}
                  decimals={stat.decimals || 0}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 uppercase tracking-[0.15em]">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Live activity marquee */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-12 relative"
        >
          <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Live activity from the community
          </p>
          <div className="relative overflow-hidden rounded-full border border-border/30 bg-card/50 backdrop-blur-sm py-3">
            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10" />

            <div className="flex animate-marquee">
              {[...marqueeItems, ...marqueeItems].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-6 shrink-0"
                >
                  <item.icon
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: item.color }}
                  />
                  <span className="text-sm text-foreground/80 whitespace-nowrap">
                    {item.text}
                  </span>
                  <span className="text-muted-foreground/30 ml-4">|</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
