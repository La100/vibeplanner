"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface TaskStatusHistoryProps {
  taskId: string;
  project: any;
}

const statusColors = {
  todo: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  review: "bg-purple-100 text-purple-700",
  done: "bg-green-100 text-green-700",
};

const getStatusName = (status: string, project: any) => {
  return project?.taskStatusSettings?.[status]?.name || status;
};

export default function TaskStatusHistory({ taskId, project }: TaskStatusHistoryProps) {
  const history = useQuery(api.tasks.getTaskStatusHistory, {
    taskId: taskId as Id<"tasks">,
  });

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Clock className="mr-2 h-5 w-5" />
            Historia zmian statusu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Brak historii zmian statusu dla tego zadania.
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
          Historia zmian statusu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry, index) => (
            <div key={entry._id} className="flex items-start space-x-4 pb-4 border-b border-gray-100 last:border-b-0">
              <Avatar className="h-8 w-8 mt-1">
                <AvatarImage src={entry.changedByUser?.imageUrl} />
                <AvatarFallback className="text-xs">
                  {entry.changedByUser?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {entry.changedByUser?.name || "Nieznany użytkownik"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(entry.changedAt, { 
                      addSuffix: true, 
                      locale: pl 
                    })}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2 mb-2">
                  {entry.previousStatus ? (
                    <>
                      <Badge 
                        variant="outline" 
                        className={`${statusColors[entry.previousStatus as keyof typeof statusColors]} text-xs`}
                      >
                        {getStatusName(entry.previousStatus, project)}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground mr-2">Utworzono z:</span>
                  )}
                  <Badge 
                    variant="outline" 
                    className={`${statusColors[entry.newStatus as keyof typeof statusColors]} text-xs`}
                  >
                    {getStatusName(entry.newStatus, project)}
                  </Badge>
                </div>
                
                {entry.notes && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded p-2 mt-2">
                    {entry.notes}
                  </p>
                )}
                
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(entry.changedAt).toLocaleString('pl-PL')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 