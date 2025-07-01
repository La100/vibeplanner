import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import { ConditionalHeader } from "@/components/ConditionalHeader";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VibePlanner",
  description: "Architektoniczny Project Manager",
  icons: {
    icon: "/convex.svg",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClerkProvider>
          <ConvexClientProvider>
            <Suspense fallback={
              <div className="min-h-screen bg-background">
                <div className="h-16 bg-muted animate-pulse border-b" />
                <div className="p-8">
                  <div className="space-y-4">
                    <div className="h-8 bg-muted rounded animate-pulse w-1/3" />
                    <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-40 bg-muted rounded animate-pulse" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            }>
              <ConditionalHeader />
              {children}
            </Suspense>
            <Toaster />
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

