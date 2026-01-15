"use client";


import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface TaskStatusHistoryProps {
  project: {
    taskStatusSettings?: {
      [key: string]: {
        name: string;
        color: string;
      };
    };
  };
}



export default function TaskStatusHistory({}: TaskStatusHistoryProps) {
  // TODO: Implement getTaskStatusHistory function in convex/tasks.ts
  const history: never[] = []; // Temporary placeholder - empty array

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Clock className="mr-2 h-5 w-5" />
            Status history
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No status history for this task yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Clock className="mr-2 h-5 w-5" />
          Status history
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-center py-4">
          Status history is not implemented yet.
        </p>
        {/* TODO: Implement task status history functionality */}
      </CardContent>
    </Card>
  );
} 
