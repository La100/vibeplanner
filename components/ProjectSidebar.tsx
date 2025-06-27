"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Home, GanttChartSquare, CheckSquare, Folder, Users, Settings, ArrowLeft } from "lucide-react";

export function ProjectSidebar() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const project = useQuery(api.myFunctions.getProjectBySlug, { 
    teamSlug: params.slug, 
    projectSlug: params.projectSlug 
  });

  if (!project) {
    return (
      <aside className="w-64 flex-shrink-0 border-r bg-background p-4 flex flex-col justify-between">
        <div>
          <div className="h-10 bg-muted rounded-md animate-pulse mb-4" />
          <div className="h-8 bg-muted rounded-md animate-pulse w-3/4" />
        </div>
      </aside>
    );
  }

  const navLinks = [
    { href: `/${params.slug}/${params.projectSlug}`, label: "Overview", icon: Home },
    { href: `/${params.slug}/${params.projectSlug}/tasks`, label: "Tasks", icon: CheckSquare },
    { href: `/${params.slug}/${params.projectSlug}/files`, label: "Files", icon: Folder },
    { href: `/${params.slug}/${params.projectSlug}/gantt`, label: "Gantt Chart", icon: GanttChartSquare },
    { href: `/${params.slug}/${params.projectSlug}/members`, label: "Members", icon: Users },
    { href: `/${params.slug}/${params.projectSlug}/settings`, label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-72 flex-shrink-0 border-r bg-background p-6 flex flex-col justify-between">
      <div>
        <div className="mb-8">
          <h2 className="text-xl font-bold">{project.name}</h2>
          <p className="text-sm text-muted-foreground">{project.client || "Internal Project"}</p>
        </div>
        <nav className="flex flex-col gap-2">
          {navLinks.map((link) => (
            <Button key={link.label} variant="ghost" className="justify-start" asChild>
              <Link href={link.href}>
                <link.icon className="mr-3 h-5 w-5" />
                {link.label}
              </Link>
            </Button>
          ))}
        </nav>
      </div>

      <div>
        <div className="my-4 border-t border-border" />
        <Button variant="outline" className="w-full justify-start" asChild>
          <Link href={`/${params.slug}`}>
            <ArrowLeft className="mr-3 h-5 w-5" />
            Back to Team
          </Link>
        </Button>
      </div>
    </aside>
  );
} 