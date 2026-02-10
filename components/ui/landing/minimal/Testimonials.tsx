"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Product Designer at Spotify",
    avatar: "/placeholder-avatar-1.png",
    quote:
      "I've tried every habit app out there. VibePlanner is the first one where I actually feel like someone is watching out for me. Atlas kept me accountable for 90 days straight — my longest streak ever.",
    highlight: "90 days straight",
    color: "#C06A3D",
  },
  {
    name: "Marcus Rivera",
    role: "Founder, Rivera Wellness",
    avatar: "/placeholder-avatar-2.png",
    quote:
      "The AI assistants don't just remind you — they actually understand WHY you're struggling. Sage helped me restructure my entire morning routine and my energy levels have never been better.",
    highlight: "understand WHY",
    color: "#6D8B73",
  },
  {
    name: "Emily Park",
    role: "Engineering Manager at Stripe",
    avatar: "/placeholder-avatar-3.png",
    quote:
      "I use VibePlanner with one accountability partner and it changed my consistency. We improved our daily check-in streak by 40% in six weeks.",
    highlight: "40% improvement",
    color: "#7C5CE0",
  },
];

export function Testimonials() {
  return (
    <section className="py-28 px-6">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 backdrop-blur-sm px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Loved by Habit Builders
          </span>
          <h2 className="mt-6 font-[var(--font-display-serif)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight text-foreground leading-tight">
            Real people, real
            <br />
            <span className="gradient-text-animated">transformations</span>.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="group relative rounded-[24px] border border-border/50 bg-card p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)] overflow-hidden"
            >
              {/* Hover gradient */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${testimonial.color}06 0%, transparent 70%)`,
                }}
              />

              <div className="relative">
                {/* Quote icon */}
                <Quote
                  className="h-8 w-8 mb-4 opacity-10"
                  style={{ color: testimonial.color }}
                />

                {/* Stars */}
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4"
                      style={{
                        fill: testimonial.color,
                        color: testimonial.color,
                      }}
                    />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-base leading-relaxed text-foreground">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>

                {/* Separator */}
                <div className="h-px bg-border/50 my-6" />

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-muted overflow-hidden shrink-0 ring-2 ring-border/30">
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {testimonial.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
