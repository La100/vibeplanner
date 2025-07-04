import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from 'lucide-react';

const pricingPlans = [
  {
    title: "Free",
    price: "$0",
    description: "For individuals and small teams.",
    features: ["5 Projects", "Basic Analytics", "24/7 Support"]
  },
  {
    title: "Pro",
    price: "$29",
    description: "For growing teams and businesses.",
    features: ["Unlimited Projects", "Advanced Analytics", "Priority Support", "Team Management"]
  },
  {
    title: "Enterprise",
    price: "Custom",
    description: "For large organizations.",
    features: ["All Pro Features", "Dedicated Account Manager", "Custom Integrations"]
  }
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-20 bg-muted/50">
      <div className="container mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pricingPlans.map((plan, index) => (
            <Card key={index} className="flex flex-col">
              <CardHeader>
                <CardTitle>{plan.title}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-4xl font-bold mb-4">{plan.price}</p>
                <ul className="space-y-2 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button className="w-full mt-auto">Get Started</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection; 