import Navigation from "@/components/ui/landing/Navigation";
import { Footer } from "@/components/ui/landing/Footer";
import { Suspense } from "react";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col">
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
        <Navigation />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </Suspense>
    </div>
  );
}