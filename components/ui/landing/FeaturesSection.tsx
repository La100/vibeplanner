"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FolderOpen, BarChart3 } from "lucide-react";

const features = [
  {
    title: "Team Management",
    description: "Organize your team members, assign roles, and manage permissions.",
    icon: Users
  },
  {
    title: "Project Tracking",
    description: "Keep track of all your projects, their status, and progress.",
    icon: FolderOpen
  },
  {
    title: "Advanced Reporting",
    description: "Generate detailed reports to gain insights into your team's performance.",
    icon: BarChart3
  }
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-20">
      <div className="container mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="cursor-pointer hover:shadow-lg transition-shadow h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{feature.title}</CardTitle>
                <feature.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection; 