"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";

export function ConditionalHeader() {
  const pathname = usePathname();
  
  // Hide header on onboarding and all organization/project pages
  if (pathname !== "/" && pathname !== "/organization") {
    return null;
  }
  
  return <Header />;
} 