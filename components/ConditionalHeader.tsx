"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";

export function ConditionalHeader() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  
  // Hide header on onboarding and all project-level pages
  if (pathname.startsWith('/onboarding') || segments.length >= 2) {
    return null;
  }
  
  return <Header />;
} 