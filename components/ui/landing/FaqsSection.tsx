import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    question: "How does VibePlanner fit into our existing tool stack?",
    answer:
      "VibePlanner is a layer above your task tracker and docs. We sync with popular tools, ingest updates, and turn them into alignment rituals—without recreating your entire workflow.",
  },
  {
    question: "Can I run our own rituals or do I have to use yours?",
    answer:
      "You can start with our library or bring your own. Any ritual can be tailored with agenda steps, prompts, and AI nudges. Once saved, it becomes reusable across teams.",
  },
  {
    question: "What does the AI actually automate?",
    answer:
      "AI monitors progress signals, drafts meeting briefs, highlights risks, and creates audience-specific updates. You stay in control—it simply prepares the context you need.",
  },
  {
    question: "Do you offer onboarding support for larger teams?",
    answer:
      "Yes. The Studio plan includes guided setup sessions, and Atlas customers receive a dedicated ritual designer to co-create operating rhythms that match your teams.",
  },
];

const FaqsSection = () => {
  return (
    <section id="faqs" className="bg-white py-24 sm:py-32">
      <div className="mx-auto flex max-w-4xl flex-col gap-12 px-6 sm:px-8">
        <div className="space-y-4 text-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#E7E2D9] bg-[#FAF7F2] px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-[#6D8B73]">
            Questions, answered
          </span>
          <h2 className="text-4xl font-medium leading-tight text-foreground sm:text-[2.75rem] font-[var(--font-display-serif)]">
            Everything you need to know before starting your first ritual.
          </h2>
          <p className="text-base leading-relaxed text-[#3C3A37] sm:text-lg">
            Still unsure? Our team loves walking through real operating rhythms. Reach out and we will share examples tailored to your organisation.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={faq.question}
              value={`item-${index}`}
              className="overflow-hidden rounded-[20px] border border-[#E7E2D9] bg-[#FAF7F2]"
            >
              <AccordionTrigger className="px-6 py-5 text-left text-lg font-medium text-foreground hover:no-underline sm:px-8 sm:py-6">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 text-base leading-relaxed text-[#3C3A37] sm:px-8">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FaqsSection;
