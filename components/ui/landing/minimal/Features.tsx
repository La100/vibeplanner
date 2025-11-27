"use client";

import { motion } from "framer-motion";
import { Calendar, Layout, Users, BarChart3, Sparkles } from "lucide-react";

const features = [
  {
    title: "Project Rhythm",
    description: "Visualize progress with intuitive Gantt charts and boards.",
    icon: Layout,
    className: "md:col-span-2 md:row-span-2",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    title: "Smart Calendar",
    description: "Time-blocking made effortless.",
    icon: Calendar,
    className: "md:col-span-1 md:row-span-1",
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    title: "Moodboards",
    description: "Curate inspiration in one place.",
    icon: Sparkles,
    className: "md:col-span-1 md:row-span-1",
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    title: "Team Sync",
    description: "Collaborate without the chaos.",
    icon: Users,
    className: "md:col-span-1 md:row-span-1",
    color: "bg-green-500/10 text-green-600",
  },
  {
    title: "Analytics",
    description: "Insights that actually matter.",
    icon: BarChart3,
    className: "md:col-span-1 md:row-span-1",
    color: "bg-rose-500/10 text-rose-600",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32 px-6">
      <div className="container max-w-6xl mx-auto">
        <div className="mb-16 max-w-2xl">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-5xl font-bold tracking-tight font-display mb-6"
          >
            Everything you need. <br />
            <span className="text-muted-foreground font-serif italic">Nothing you don't.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-muted-foreground"
          >
            A suite of powerful tools stripped down to their essence. Designed for focus, clarity, and flow.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(200px,auto)]">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`group relative overflow-hidden rounded-3xl bg-muted/30 border border-border/50 p-8 hover:bg-muted/50 transition-colors ${feature.className}`}
            >
              <div className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}>
                <feature.icon className="h-6 w-6" />
              </div>
              
              <div className="relative z-10">
                <h3 className="text-xl font-semibold mb-2 group-hover:text-foreground transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground group-hover:text-foreground/80 transition-colors">
                  {feature.description}
                </p>
              </div>

              {/* Decorative background pattern */}
              <div className="absolute right-0 top-0 -z-10 h-full w-full opacity-0 group-hover:opacity-10 transition-opacity duration-500">
                 <svg className="absolute right-0 top-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <pattern id={`grid-${index}`} width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="1"/>
                    </pattern>
                    <rect width="100%" height="100%" fill={`url(#grid-${index})`} />
                 </svg>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}




