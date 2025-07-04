import FeaturesSection from "@/components/ui/landing/FeaturesSection";
import PricingSection from "@/components/ui/landing/PricingSection";
import FaqsSection from "@/components/ui/landing/FaqsSection";
import { HeroSection } from "@/components/ui/landing/HeroSection";

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <FaqsSection />
    </>
  );
} 