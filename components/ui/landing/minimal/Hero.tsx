"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, PlayCircle } from "lucide-react";
import { SignUpButton } from "@clerk/nextjs";

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-32 pb-20 px-6">
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50 dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)]"></div>
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-100 blur-[100px] opacity-30 dark:bg-purple-900/20 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-blue-100 blur-[100px] opacity-30 dark:bg-blue-900/20 animate-pulse" style={{ animationDelay: "2s" }}></div>

      <div className="container max-w-6xl mx-auto flex flex-col items-center text-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-6"
        >
          <span className="inline-flex items-center rounded-full border border-border bg-background/50 px-3 py-1 text-sm font-medium text-muted-foreground backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
            VibePlanner 2.0 is here
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="text-6xl md:text-8xl font-bold tracking-tight text-foreground mb-8 font-display max-w-4xl"
        >
          Plan your <span className="italic text-muted-foreground font-serif">vibe.</span>
          <br />
          Own your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">rhythm.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed"
        >
          The minimalist workspace for ambitious teams. seamlessly combine projects, calendars, and moodboards into one calm flow.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <SignUpButton mode="modal">
            <Button size="lg" className="h-14 px-8 rounded-full text-lg bg-foreground text-background hover:bg-foreground/90 shadow-lg hover:shadow-xl transition-all">
              Start Planning Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </SignUpButton>
          
          <Button variant="outline" size="lg" className="h-14 px-8 rounded-full text-lg border-border hover:bg-muted transition-all group">
            <PlayCircle className="mr-2 h-5 w-5 group-hover:text-blue-600 transition-colors" />
            Watch the film
          </Button>
        </motion.div>
      </div>

      {/* Product Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 100, rotateX: 20 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
        className="mt-24 w-full max-w-6xl px-4 perspective-1000"
        style={{ perspective: "1000px" }}
      >
        <div className="relative rounded-2xl border border-border bg-card/50 backdrop-blur-sm shadow-2xl overflow-hidden aspect-[16/9] group">
            <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/20 to-background z-0"></div>
            
            {/* Abstract UI Representation */}
            <div className="relative z-10 p-8 md:p-12 h-full flex flex-col">
                <div className="flex items-center justify-between mb-12 border-b border-border/10 pb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                        <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                    </div>
                    <div className="h-2 w-32 bg-border/20 rounded-full"></div>
                </div>
                
                <div className="grid grid-cols-12 gap-6 h-full">
                    {/* Sidebar */}
                    <div className="col-span-3 lg:col-span-2 hidden md:flex flex-col gap-4 border-r border-border/10 pr-6">
                        <div className="h-8 w-3/4 bg-foreground/5 rounded-md"></div>
                        <div className="h-4 w-1/2 bg-foreground/5 rounded-md mt-4"></div>
                        <div className="h-4 w-full bg-foreground/5 rounded-md"></div>
                        <div className="h-4 w-2/3 bg-foreground/5 rounded-md"></div>
                        <div className="mt-auto h-12 w-full bg-foreground/5 rounded-md"></div>
                    </div>
                    
                    {/* Main Content */}
                    <div className="col-span-12 md:col-span-9 lg:col-span-10 flex flex-col">
                        <div className="flex items-end justify-between mb-8">
                            <div className="space-y-3">
                                <div className="h-10 w-64 bg-foreground/10 rounded-lg"></div>
                                <div className="h-4 w-48 bg-foreground/5 rounded-md"></div>
                            </div>
                            <div className="h-10 w-32 bg-blue-500/10 rounded-full hidden sm:block"></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                            {/* Card 1 */}
                            <motion.div 
                                whileHover={{ y: -5 }}
                                className="rounded-xl bg-white/40 dark:bg-white/5 border border-white/10 p-6 shadow-sm flex flex-col gap-3"
                            >
                                <div className="h-32 rounded-lg bg-gradient-to-br from-orange-100 to-rose-100 dark:from-orange-900/20 dark:to-rose-900/20 w-full mb-2"></div>
                                <div className="h-4 w-3/4 bg-foreground/10 rounded-md"></div>
                                <div className="h-3 w-1/2 bg-foreground/5 rounded-md"></div>
                            </motion.div>
                             {/* Card 2 */}
                             <motion.div 
                                whileHover={{ y: -5 }}
                                className="rounded-xl bg-white/40 dark:bg-white/5 border border-white/10 p-6 shadow-sm flex flex-col gap-3"
                            >
                                <div className="h-32 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20 w-full mb-2"></div>
                                <div className="h-4 w-3/4 bg-foreground/10 rounded-md"></div>
                                <div className="h-3 w-1/2 bg-foreground/5 rounded-md"></div>
                            </motion.div>
                             {/* Card 3 */}
                             <motion.div 
                                whileHover={{ y: -5 }}
                                className="rounded-xl bg-white/40 dark:bg-white/5 border border-white/10 p-6 shadow-sm flex flex-col gap-3"
                            >
                                <div className="h-32 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/20 dark:to-indigo-900/20 w-full mb-2"></div>
                                <div className="h-4 w-3/4 bg-foreground/10 rounded-md"></div>
                                <div className="h-3 w-1/2 bg-foreground/5 rounded-md"></div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Reflection/Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-2xl -z-10 opacity-0 group-hover:opacity-50 transition-opacity duration-500"></div>
        </div>
      </motion.div>
    </section>
  );
}




