import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What is VibePlanner?",
    answer: "VibePlanner is a project management tool designed to help you organize your work, collaborate with your team, and track progress seamlessly."
  },
  {
    question: "Is there a free trial?",
    answer: "Yes, we offer a free plan for individuals and small teams with no time limit. You can upgrade to a paid plan as your team grows."
  },
  {
    question: "Can I cancel my subscription at any time?",
    answer: "Absolutely. You can cancel your subscription at any time, and you will not be billed for the next cycle."
  }
];

const FaqsSection = () => {
  return (
    <section id="faqs" className="py-20">
      <div className="container mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FaqsSection; 