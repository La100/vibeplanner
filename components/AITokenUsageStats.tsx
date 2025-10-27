"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

const AITokenUsageStats = () => {

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            AI Token Usage
          </CardTitle>
          <CardDescription>Token usage tracking is currently disabled.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Token usage statistics are not available at this time.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AITokenUsageStats;












































