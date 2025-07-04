"use client";

import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function HeroSection() {
  const { user } = useUser();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl">
          Organize Your Projects, Master Your Workflow
        </h1>
        <p className="mt-6 text-xl text-muted-foreground">
          VibePlanner is the ultimate tool to bring clarity to your team's work. Manage projects, track progress, and collaborate seamlessly.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Button size="lg" asChild>
            <Link href={user ? "/organization" : "/sign-up"}>
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
} 