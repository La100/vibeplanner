"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { CompanySidebar } from "@/components/CompanySidebar";

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <CompanySidebar />
      <SidebarInset>
        <main className="flex-1">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
} 