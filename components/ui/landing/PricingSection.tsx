import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import Link from "next/link";

const pricingPlans = [
  {
    title: "Starter",
    price: "Free",
    cadence: "up to 3 collaborators",
    description: "A calm place to try rituals, share notes, and invite your first projects.",
    features: [
      "Weekly planning ritual templates",
      "Two project rooms with timeline view",
      "Unlimited guests & read-only viewers",
      "Email summaries after every ceremony",
    ],
    ctaLabel: "Start for free",
    href: "/sign-up",
    isHighlight: false,
  },
  {
    title: "Studio",
    price: "$28",
    cadence: "per seat / month",
    description: "For growing teams who need the full rhythm library and AI-guided reviews.",
    features: [
      "All Starter features",
      "Unlimited ritual templates & automations",
      "AI-powered playback & highlight reels",
      "Cross-team portfolio dashboards",
      "Calendar sync with personal focus blocks",
    ],
    ctaLabel: "Start a trial",
    href: "/sign-up",
    isHighlight: true,
  },
  {
    title: "Atlas",
    price: "Let’s talk",
    cadence: "annual partnership",
    description: "Enterprise alignment with tailored guidance for complex initiatives.",
    features: [
      "Dedicated ritual designer",
      "SOC2 & SSO included",
      "Executive briefing workspace",
      "Change management playbooks",
    ],
    ctaLabel: "Book a walkthrough",
    href: "/contact",
    isHighlight: false,
  },
];

const PricingSection = () => {
  return (
    <section id="pricing" className="bg-[#F2EEE6] py-24 sm:py-32">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 sm:px-8">
        <div className="max-w-2xl space-y-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#D8D0C4] bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-[#6D8B73]">
            Pricing made honest
          </span>
          <h2 className="text-4xl font-medium leading-tight text-[#1A1A1A] sm:text-[2.75rem] font-[var(--font-display-serif)]">
            Start with a calm foundation and scale when the rhythm unlocks value.
          </h2>
          <p className="text-lg leading-relaxed text-[#3C3A37] sm:text-xl">
            Every plan includes unlimited guests, shared ritual templates, and AI-generated summaries. Upgrade when you need deeper intelligence or bespoke guidance.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <Card
              key={plan.title}
              className={
                plan.isHighlight
                  ? "relative flex h-full flex-col overflow-hidden rounded-[28px] border border-[#1A1A1A] bg-[#0E0E0E] p-8 text-white shadow-[0_40px_90px_rgba(14,14,14,0.4)]"
                  : "flex h-full flex-col overflow-hidden rounded-[28px] border border-[#E7E2D9] bg-white p-8 shadow-[0_30px_80px_rgba(20,20,20,0.05)]"
              }
            >
              {plan.isHighlight && (
                <span className="absolute right-8 top-8 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0E0E0E]">
                  Most loved
                </span>
              )}

              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[#8C8880]">
                  {plan.cadence}
                </p>
                <h3
                  className={
                    plan.isHighlight
                      ? "text-[2.25rem] font-medium text-white font-[var(--font-display-serif)]"
                      : "text-[2.25rem] font-medium text-[#1A1A1A] font-[var(--font-display-serif)]"
                  }
                >
                  {plan.title}
                </h3>
                <div className="flex items-baseline gap-2">
                  <p
                    className={
                      plan.isHighlight
                        ? "text-3xl font-semibold text-white"
                        : "text-3xl font-semibold text-[#1A1A1A]"
                    }
                  >
                    {plan.price}
                  </p>
                </div>
                <p
                  className={
                    plan.isHighlight
                      ? "text-sm leading-relaxed text-[#EDE5DD]"
                      : "text-sm leading-relaxed text-[#3C3A37]"
                  }
                >
                  {plan.description}
                </p>
              </div>

              <ul className="mt-8 space-y-3 text-sm leading-relaxed">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3"
                  >
                    <span
                      className={
                        plan.isHighlight
                          ? "mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/30 text-white"
                          : "mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#E7E2D9] text-[#6D8B73]"
                      }
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span
                      className={
                        plan.isHighlight ? "text-[#F7F2EA]" : "text-[#3C3A37]"
                      }
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-10">
                <Button
                  asChild
                  className={
                    plan.isHighlight
                      ? "w-full rounded-full bg-white py-3 text-sm font-semibold uppercase tracking-[0.24em] text-[#0E0E0E] hover:bg-white/90"
                      : "w-full rounded-full bg-[#0E0E0E] py-3 text-sm font-semibold uppercase tracking-[0.24em] text-white shadow-[0_16px_32px_rgba(14,14,14,0.16)] hover:bg-[#1F1F1F]"
                  }
                >
                  <Link href={plan.href}>{plan.ctaLabel}</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
