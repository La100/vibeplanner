import type { Metadata } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import ConvexClientProvider from "@/components/providers/ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import type { ClerkProviderProps } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "VibePlanner",
  description: "AI Assistant Manager",
  icons: {
    icon: "/convex.svg",
  },
};

const clerkAppearance: ClerkProviderProps["appearance"] = {
  layout: {
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
  },
  variables: {
    colorPrimary: "#000000",
    colorText: "#000000",
    colorInputText: "#000000",
    colorInputBackground: "#F3EFE7",
    colorBackground: "#FFFFFF",
    borderRadius: "2rem",
  },
  elements: {
    modalBackdrop: "backdrop-blur-sm bg-black/60",
    modal: "rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.1)] border border-[#D8D4CC] bg-[#F3EFE7]",
    card: "rounded-3xl border border-[#D8D4CC] shadow-[0_22px_70px_rgba(0,0,0,0.05)] bg-[#FAF9F6]",
    headerTitle: "text-xl font-semibold text-[#000000]",
    headerSubtitle: "text-sm text-[#525252]",
    socialButtons: "gap-3",
    socialButtonsBlockButton:
      "h-11 rounded-xl border border-[#D8D4CC] bg-[#FFFFFF] text-[#000000] hover:bg-[#F3EFE7] shadow-none",
    socialButtonsBlockButtonText: "text-sm font-semibold",
    socialButtonsProviderIcon: "text-base",
    dividerText: "text-[#a3a3a3] text-xs font-semibold uppercase tracking-[0.16em]",
    dividerLine: "bg-[#e5e5e5]",
    formFieldLabel: "text-xs font-semibold text-[#525252] uppercase tracking-[0.06em]",
    formFieldInput:
      "h-11 rounded-3xl border border-[#D8D4CC] bg-[#FFFFFF] text-[#000000] placeholder:text-[#a3a3a3] focus:ring-2 focus:ring-[#000000] focus:border-[#000000]",
    formFieldInputShowPasswordButton: "text-[#525252]",
    formButtonPrimary:
      "h-11 rounded-full bg-[#000000] text-white text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.1)] hover:bg-[#1a1a1a]",
    footerActionText: "text-[#6b7280] text-sm",
    footerActionLink: "text-[#111111] font-semibold hover:underline",
    footer: "pt-2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased font-sans`}>
        <ClerkProvider
          appearance={clerkAppearance}
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/onboarding"
          afterSignInUrl="/dashboard"
          afterSignUpUrl="/onboarding"
        >
          <ConvexClientProvider>
            {children}
            <Toaster />
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
