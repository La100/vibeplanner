import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | VibePlanner",
  description: "Terms governing your use of VibePlanner.",
};

const lastUpdated = "February 10, 2026";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background px-6 py-12 md:py-16">
      <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-8 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {lastUpdated}
        </p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-foreground/90">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using VibePlanner, you agree to these Terms of
              Service. If you do not agree, do not use the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              2. Eligibility and Accounts
            </h2>
            <p>
              You are responsible for maintaining the confidentiality of your
              account credentials and for all activity under your account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              3. Subscriptions and Billing
            </h2>
            <p>
              Some features require a paid subscription. Billing and payment
              processing are handled by Stripe. Fees are non-refundable except
              where required by law or expressly stated otherwise.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              4. Acceptable Use
            </h2>
            <p>
              You agree not to misuse the service, interfere with its operation,
              attempt unauthorized access, or use VibePlanner for unlawful
              activities.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              5. AI-Generated Content
            </h2>
            <p>
              VibePlanner may generate assistant responses based on model output.
              AI output can be inaccurate and should be reviewed before making
              important decisions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              6. Intellectual Property
            </h2>
            <p>
              VibePlanner and its associated content, branding, and software are
              protected by applicable intellectual property laws. These Terms do
              not transfer ownership rights to you.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              7. Termination
            </h2>
            <p>
              We may suspend or terminate access if you violate these Terms or
              if continued access poses security, legal, or operational risk.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              8. Disclaimer of Warranties
            </h2>
            <p>
              The service is provided on an &quot;as is&quot; and &quot;as available&quot;
              basis, without warranties of any kind to the extent permitted by
              law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              9. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, VibePlanner will not be
              liable for indirect, incidental, special, consequential, or
              punitive damages arising from your use of the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              10. Changes to Terms
            </h2>
            <p>
              We may update these Terms from time to time. If we make material
              changes, we will update the date above and may provide additional
              notice in the app.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              11. Contact
            </h2>
            <p>
              For questions about these Terms, contact us through{" "}
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
