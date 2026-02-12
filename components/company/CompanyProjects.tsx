"use client";

import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreateAssistantView } from "./CreateAssistantView";
import { getPreset } from "@/convex/ai/presets";
import { cn } from "@/lib/utils";
import { resolveAssistantImageUrl } from "@/lib/assistantImage";

export default function CompanyProjects() {
  const router = useRouter();
  const team = useQuery(apiAny.teams.getMyTeam);
  const projects = useQuery(apiAny.projects.listProjectsForCurrentUser);
  const [isCreating, setIsCreating] = useState(false);

  if (!team || !projects) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">
        {isCreating ? (
          <motion.div
            key="create"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <CreateAssistantView
              teamId={team._id}
              onCancel={() => setIsCreating(false)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className="border-b border-border/40">
              <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-semibold">Assistants</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                      Manage your assistants
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setIsCreating(true)}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      New Assistant
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-12">
              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <Plus className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">No assistants yet</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Create your first assistant to get started
                      </p>
                    </div>
                    <Button
                      onClick={() => setIsCreating(true)}
                      className="gap-2 mt-4"
                    >
                      <Plus className="w-4 h-4" />
                      Create Assistant
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {projects.map((project: {
                    _id: string;
                    slug: string;
                    name: string;
                    imageUrl?: string;
                    assistantPreset?: string;
                  }) => {
                    const preset = getPreset(project.assistantPreset || "");
                    const displayImage = resolveAssistantImageUrl({
                      imageUrl: project.imageUrl,
                      assistantPreset: project.assistantPreset,
                    });

                    return (
                      <motion.div
                        key={project._id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className="group cursor-pointer"
                        onClick={() => router.push(`/organisation/projects/${project.slug}`)}
                      >
                        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card transition-all">
                          {/* Image */}
                          <div className="aspect-[3/4] overflow-hidden bg-muted">
                            {displayImage ? (
                              <img
                                src={displayImage}
                                alt={project.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                              />
                            ) : preset?.gradient ? (
                              <div className={cn("w-full h-full bg-gradient-to-br", preset.gradient)} />
                            ) : (
                              <div className="w-full h-full bg-muted" />
                            )}
                          </div>

                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

                          {/* Title and description */}
                          <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
                            <h3 className="text-white font-semibold text-lg drop-shadow-sm line-clamp-1">
                              {project.name}
                            </h3>
                            {preset?.description && (
                              <p className="text-white/75 text-sm line-clamp-2 mt-1">
                                {preset.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
