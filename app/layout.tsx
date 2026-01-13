import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import type { ClerkProviderProps } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VibePlanner",
  description: "Architektoniczny Project Manager",
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
    colorPrimary: "#0f172a",
    colorText: "#0f172a",
    colorInputText: "#0f172a",
    colorInputBackground: "#f6f8fb",
    colorBackground: "#ffffff",
    borderRadius: "16px",
  },
  elements: {
    modalBackdrop: "backdrop-blur-sm bg-slate-900/60",
    modal: "rounded-3xl shadow-[0_24px_80px_rgba(15,23,42,0.22)] border border-white/70 bg-white/95",
    card: "rounded-3xl border border-[#E5E7EB] shadow-[0_22px_70px_rgba(15,23,42,0.18)] bg-white/95",
    headerTitle: "text-xl font-semibold text-[#0f172a]",
    headerSubtitle: "text-sm text-[#6b7280]",
    socialButtons: "gap-3",
    socialButtonsBlockButton:
      "h-11 rounded-xl border border-[#e5e7eb] bg-[#f7f7fb] text-[#0f172a] hover:bg-white shadow-none",
    socialButtonsBlockButtonText: "text-sm font-semibold",
    socialButtonsProviderIcon: "text-base",
    dividerText: "text-[#9ca3af] text-xs font-semibold uppercase tracking-[0.16em]",
    dividerLine: "bg-[#e5e7eb]",
    formFieldLabel: "text-xs font-semibold text-[#4b5563] uppercase tracking-[0.06em]",
    formFieldInput:
      "h-11 rounded-xl border border-[#d7dce7] bg-[#f6f8fb] text-[#0f172a] placeholder:text-[#94a3b8] focus:ring-2 focus:ring-[#111111] focus:border-[#111111]",
    formFieldInputShowPasswordButton: "text-[#6b7280]",
    formButtonPrimary:
      "h-11 rounded-xl bg-[#161616] text-white text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.2)] hover:bg-black",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} antialiased`}
      >
        <ClerkProvider
          appearance={clerkAppearance}
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
          afterSignInUrl="/dashboard"
          afterSignUpUrl="/dashboard"
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
