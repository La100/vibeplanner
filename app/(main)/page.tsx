import { HeroSection } from "@/components/ui/landing/minimal/HeroSection";
import { SocialProofBar } from "@/components/ui/landing/minimal/SocialProofBar";
import { ProblemSolution } from "@/components/ui/landing/minimal/ProblemSolution";
import { AIAssistantsShowcase } from "@/components/ui/landing/minimal/AIAssistantsShowcase";
import { FeaturesGrid } from "@/components/ui/landing/minimal/FeaturesGrid";
import { HowItWorks } from "@/components/ui/landing/minimal/HowItWorks";
import { Testimonials } from "@/components/ui/landing/minimal/Testimonials";
import { PricingSection } from "@/components/ui/landing/minimal/PricingSection";
import { FaqSection } from "@/components/ui/landing/minimal/FaqSection";
import { FinalCTA } from "@/components/ui/landing/minimal/FinalCTA";

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <SocialProofBar />
      <ProblemSolution />
      <AIAssistantsShowcase />
      <FeaturesGrid />
      <HowItWorks />
      <Testimonials />
      <PricingSection />
      <FaqSection />
      <FinalCTA />
    </>
  );
}
