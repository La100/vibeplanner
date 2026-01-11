"use client";

import { useOrganizationList } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function OrganizationPage() {
  const router = useRouter();
  const { userMemberships, setActive, isLoaded } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  useEffect(() => {
    if (!isLoaded) return;

    const organizations = userMemberships?.data || [];

    // Jeśli użytkownik ma organizację (lub więcej), automatycznie przekieruj do pierwszej
    if (organizations.length >= 1) {
      const org = organizations[0].organization;
      setActive?.({ organization: org.id }).then(() => {
        router.push(`/${org.slug}`);
      });
      return;
    }

    // Jeśli nie ma organizacji, przekieruj do /dashboard (pokaże ekran tworzenia)
    router.push("/dashboard");
  }, [isLoaded, userMemberships, setActive, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
} 