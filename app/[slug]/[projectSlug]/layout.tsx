import { ProjectSidebar } from "@/components/ProjectSidebar";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <ProjectSidebar />
      <main className="flex-1 p-8 bg-muted/30">
        {children}
      </main>
    </div>
  );
} 