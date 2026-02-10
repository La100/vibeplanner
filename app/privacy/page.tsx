import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | VibePlanner",
  description: "How VibePlanner collects, uses, and protects your personal data.",
};

const lastUpdated = "February 10, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-12 md:py-16">
      <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-8 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {lastUpdated}
        </p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-foreground/90">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              1. Overview
            </h2>
            <p>
              This Privacy Policy explains how VibePlanner collects, uses,
              discloses, and protects information when you use our app and
              website.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              2. Information We Collect
            </h2>
            <p>
              We collect account and profile information you provide directly,
              such as your name, email, organization details, and onboarding
              preferences.
            </p>
            <p>
              We also collect usage data needed to operate the product, such as
              activity logs, habit/check-in history, assistant messages, and
              technical diagnostics.
            </p>
            <p>
              Payment details are processed by Stripe. We do not store your full
              payment card number on our servers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              3. How We Use Information
            </h2>
            <p>
              We use collected information to provide and improve VibePlanner,
              personalize assistant responses, maintain account security, process
              subscriptions, and communicate service-related updates.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              4. How We Share Information
            </h2>
            <p>
              We share information only as needed to run the service, including
              with trusted processors such as authentication, hosting, analytics,
              AI inference, and billing providers. We may also disclose
              information if required by law or to protect our legal rights.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              5. Data Retention
            </h2>
            <p>
              We retain personal data for as long as needed to provide the
              service, comply with legal obligations, resolve disputes, and
              enforce agreements. Retention periods depend on data type and
              account status.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              6. Security
            </h2>
            <p>
              We use reasonable technical and organizational safeguards designed
              to protect personal data. No system can be guaranteed completely
              secure, and you use the service at your own risk.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              7. Your Choices
            </h2>
            <p>
              You may request access, correction, or deletion of your personal
              data, subject to applicable law and technical constraints. You can
              also manage some account preferences directly in the app.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              8. Children&apos;s Privacy
            </h2>
            <p>
              VibePlanner is not intended for children under 13, and we do not
              knowingly collect personal data from children under 13.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Material
              changes will be reflected by updating the date above and, when
              appropriate, by additional notice inside the product.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              10. Contact
            </h2>
            <p>
              For privacy questions, contact us through{" "}
              <Link className="underline underline-offset-2" href="/help">
                /help
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
