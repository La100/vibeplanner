"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, FolderOpen, BarChart3, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const { user, isSignedIn } = useUser();
  const teams = useQuery(api.myFunctions.listUserTeams, isSignedIn ? {} : "skip");

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center">
      {/* Main Content */}
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            Organize Your Projects, Master Your Workflow
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            VibePlanner is the ultimate tool to bring clarity to your team's work. Manage projects, track progress, and collaborate seamlessly.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link href={user ? "/organization" : "/sign-up"}>
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Section */}
        <section id="features" className="py-16">
          <div className="grid gap-8 md:grid-cols-3">
            <Link href={user ? "/organization" : "/sign-up"} className="block">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Project Management</CardTitle>
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Create, assign, and track tasks with intuitive boards.
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href={user ? "/organization" : "/sign-up"} className="block">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Team Collaboration</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Keep everyone in sync with shared calendars and files.
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href={user ? "/organization" : "/sign-up"} className="block">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Analytics & Reports</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Gain insights into your team's performance.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        {user && teams && teams.length > 0 && (
          <section id="your-teams" className="py-8">
            <h2 className="text-3xl font-bold text-center">Your Teams</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <Card key={team._id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5"/>
                      {team.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/${team.slug}`}>
                        Go to Dashboard
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
