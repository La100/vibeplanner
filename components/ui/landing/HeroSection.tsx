"use client";

import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

export function HeroSection() {
  const { user } = useUser();

  const primaryCtaHref = useMemo(() => (user ? "/dashboard" : "/sign-up"), [user]);

  return (
    <section className="relative overflow-hidden bg-[#FAF7F2]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-200px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#F1E8DF] blur-3xl" />
        <div className="absolute bottom-[-160px] right-[-120px] h-[320px] w-[320px] rounded-full bg-[#E7E2D9] blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-16 px-6 pb-24 pt-16 sm:px-8 lg:flex-row lg:items-center lg:gap-20 lg:pb-32 lg:pt-24">
        <div className="flex flex-1 flex-col gap-10">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#E7E2D9] bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-[#6D8B73]">
            Calm clarity for ambitious teams
          </span>

          <div className="space-y-5">
            <h1 className="text-5xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-[4rem] font-[var(--font-display-serif)]">
              Impossible?
              <br />
              In rhythm.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-[#3C3A37] sm:text-xl">
              The AI ritual partner for problem solvers. Keep every initiative aligned, every update ready, and every ceremony beautifully calm.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button
              asChild
              className="rounded-full bg-[#0E0E0E] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(14,14,14,0.18)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#1F1F1F]"
            >
              <Link href={primaryCtaHref}>
                Start planning
                <ArrowUpRight className="ml-3 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-full border-[#E7E2D9] bg-white px-6 py-3 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/90"
              asChild
            >
              <Link href="#features">Explore features</Link>
            </Button>
          </div>

          <div className="mt-10 w-full max-w-sm rounded-[32px] border border-[#E7E2D9] bg-white p-6 shadow-[0_24px_60px_rgba(20,20,20,0.08)]">
            <Button
              variant="outline"
              className="flex w-full items-center justify-center gap-3 rounded-[18px] border-[#E7E2D9] bg-white py-3 text-sm font-medium text-[#1A1A1A] hover:bg-[#F2EEE6]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F5F0E9] text-xs font-semibold text-[#EA4335]">
                G
              </span>
              Continue with Google
            </Button>

            <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-[#C0B9AF]">
              <span className="h-px flex-1 bg-[#E7E2D9]" />
              or
              <span className="h-px flex-1 bg-[#E7E2D9]" />
            </div>

            <form className="space-y-3" action={primaryCtaHref} method="get">
              <Input
                type="email"
                name="email"
                placeholder="Enter your email"
                className="h-12 rounded-[18px] border-[#E7E2D9] bg-[#FAF7F2] text-sm text-foreground placeholder:text-[#8C8880] focus-visible:ring-[#0A84FF]"
              />
              <Button
                type="submit"
                className="w-full rounded-[18px] bg-[#0E0E0E] py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(14,14,14,0.16)] hover:bg-[#1F1F1F]"
              >
                Continue with email
              </Button>
            </form>

            <p className="mt-4 text-xs leading-relaxed text-[#8C8880]">
              By continuing you agree to VibePlanner&apos;s{" "}
              <Link href="/privacy" className="underline hover:text-[#1A1A1A]">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="relative flex flex-1 justify-center">
          <div className="relative w-full max-w-[420px]">
            <div className="absolute -left-10 top-12 hidden h-24 w-24 rounded-full border border-[#E7E2D9] sm:block" />
            <div className="absolute -right-6 bottom-20 hidden h-16 w-16 rounded-full bg-[#6D8B73]/15 sm:block" />

            <div className="relative overflow-hidden rounded-[36px] bg-[#C06A3D] shadow-[0_40px_80px_rgba(192,106,61,0.32)]">
              <div className="relative aspect-[3/4]">
                <div className="absolute inset-0 bg-[linear-gradient(140deg,#C06A3D_0%,#D97F54_45%,#A85F39_100%)]" />
                <div className="absolute inset-0 opacity-30 mix-blend-soft-light" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.3) 0, transparent 55%)" }} />
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#331B10]/20 to-transparent" />
                <div className="absolute inset-6 rounded-[28px] border border-white/15" />
                <div className="absolute bottom-10 left-10">
                  <span className="text-sm uppercase tracking-[0.22em] text-[#FCEFE5]">
                    Ritual in motion
                  </span>
                  <p className="mt-3 max-w-[220px] text-lg leading-7 text-[#FDF2E8]">
                    Weekly alignment snapshots that highlight blockers before they grow.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
