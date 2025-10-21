"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FolderOpen, BarChart3, MessageSquare, Calendar, Brain, FileText, CheckSquare, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    title: "AI-Powered Insights",
    description: "Get intelligent suggestions and automated task recommendations powered by advanced AI.",
    icon: Brain,
    gradient: "from-purple-500 to-pink-500"
  },
  {
    title: "Team Collaboration",
    description: "Work seamlessly with your team through real-time chat, mentions, and notifications.",
    icon: Users,
    gradient: "from-blue-500 to-cyan-500"
  },
  {
    title: "Project Tracking",
    description: "Track all your projects with kanban boards, timelines, and custom workflows.",
    icon: FolderOpen,
    gradient: "from-green-500 to-emerald-500"
  },
  {
    title: "Advanced Analytics",
    description: "Generate detailed reports and visualize your team's performance with interactive dashboards.",
    icon: BarChart3,
    gradient: "from-orange-500 to-red-500"
  },
  {
    title: "Smart Calendar",
    description: "Never miss a deadline with integrated calendar, reminders, and Gantt charts.",
    icon: Calendar,
    gradient: "from-violet-500 to-purple-500"
  },
  {
    title: "Rich Notes & Docs",
    description: "Create beautiful documents with our advanced editor supporting markdown and collaboration.",
    icon: FileText,
    gradient: "from-pink-500 to-rose-500"
  },
  {
    title: "Task Management",
    description: "Organize tasks with priorities, labels, assignments, and dependencies.",
    icon: CheckSquare,
    gradient: "from-cyan-500 to-blue-500"
  },
  {
    title: "Real-time Chat",
    description: "Communicate instantly with team members and keep all conversations organized.",
    icon: MessageSquare,
    gradient: "from-indigo-500 to-blue-500"
  },
  {
    title: "Smart Automation",
    description: "Automate repetitive tasks and workflows to save time and boost productivity.",
    icon: Sparkles,
    gradient: "from-yellow-500 to-orange-500"
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5
    }
  }
};

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-purple-50/30 to-background dark:via-purple-950/10" />

      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              succeed
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed to streamline your workflow and boost team productivity
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Card className="group cursor-pointer hover:shadow-xl transition-all duration-300 h-full border-2 hover:border-purple-200 dark:hover:border-purple-900 relative overflow-hidden">
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-blue-500/0 group-hover:from-purple-500/5 group-hover:to-blue-500/5 transition-all duration-300" />

                <CardHeader className="relative">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection; 