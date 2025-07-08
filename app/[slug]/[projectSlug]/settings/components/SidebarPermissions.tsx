"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  LayoutDashboard,
  Settings, 
  Calendar,
  GanttChartSquare,
  ShoppingCart,
  CheckSquare,
  Files,
  Eye,
  Save
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface SidebarPermissionsProps {
  projectId: Id<"projects">;
}

interface PermissionSection {
  key: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const sidebarSections: PermissionSection[] = [
  { 
    key: "overview", 
    label: "Overview", 
    icon: LayoutDashboard,
    description: "Project overview and statistics"
  },
  { 
    key: "tasks", 
    label: "Tasks", 
    icon: CheckSquare,
    description: "Task management and tracking"
  },
  { 
    key: "calendar", 
    label: "Calendar", 
    icon: Calendar,
    description: "Project calendar and scheduling"
  },
  { 
    key: "gantt", 
    label: "Gantt Chart", 
    icon: GanttChartSquare,
    description: "Project timeline visualization"
  },
  { 
    key: "files", 
    label: "Files", 
    icon: Files,
    description: "File management and sharing"
  },
  { 
    key: "shopping_list", 
    label: "Shopping List", 
    icon: ShoppingCart,
    description: "Project shopping and procurement"
  },
  { 
    key: "settings", 
    label: "Settings", 
    icon: Settings,
    description: "Project configuration (usually restricted for clients)"
  },
];

export default function SidebarPermissions({ projectId }: SidebarPermissionsProps) {
  const project = useQuery(api.projects.getProject, { projectId });
  const updatePermissions = useMutation(api.projects.updateProjectSidebarPermissions);
  
  const [permissions, setPermissions] = useState<Record<string, { visible: boolean }>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize permissions from project data
  useEffect(() => {
    if (project?.sidebarPermissions) {
      setPermissions(project.sidebarPermissions);
    } else {
      // Set default permissions for clients
      const defaultPermissions: Record<string, { visible: boolean }> = {};
      sidebarSections.forEach(section => {
        defaultPermissions[section.key] = {
          visible: section.key !== "settings", // Settings hidden by default
        };
      });
      setPermissions(defaultPermissions);
    }
  }, [project]);

  const updatePermission = (sectionKey: string, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [sectionKey]: {
        visible: value,
      }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePermissions({
        projectId,
        sidebarPermissions: permissions,
      });
      
      toast.success("Permissions Updated", {
        description: "Sidebar permissions have been updated successfully.",
      });
      setHasChanges(false);
    } catch (error) {
      console.error("Error updating permissions:", error);
      toast.error("Error Updating Permissions", {
        description: (error as Error).message || "Failed to update sidebar permissions.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    const defaultPermissions: Record<string, { visible: boolean }> = {};
    sidebarSections.forEach(section => {
      defaultPermissions[section.key] = {
        visible: section.key !== "settings",
      };
    });
    setPermissions(defaultPermissions);
    setHasChanges(true);
  };

  if (!project) {
    return <div>Loading permissions...</div>;
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
          <Eye className="h-4 w-4 lg:h-5 lg:w-5" />
          Client Sidebar Permissions
        </CardTitle>
        <CardDescription className="text-sm">
          Control what clients can see in the project sidebar. These settings only affect users with "client" role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-4 lg:px-6">
        <div className="space-y-4">
          {sidebarSections.map((section) => {
            const sectionPermissions = permissions[section.key] || { visible: true };
            const Icon = section.icon;
            
            return (
              <div key={section.key} className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <h4 className="text-sm font-medium">{section.label}</h4>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`${section.key}-visible`}
                        checked={sectionPermissions.visible}
                        onChange={(e) => updatePermission(section.key, e.target.checked)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor={`${section.key}-visible`} className="text-xs flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Visible for clients
                      </Label>
                    </div>
                  </div>
                </div>
                
                {section.key !== sidebarSections[sidebarSections.length - 1].key && (
                  <Separator className="my-4" />
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="flex-1 sm:flex-none"
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={resetToDefaults}
              disabled={isSaving}
              className="flex-1 sm:flex-none"
            >
              Reset to Defaults
            </Button>
          </div>
          
          {hasChanges && (
            <p className="text-xs text-muted-foreground mt-2">
              You have unsaved changes. Click "Save Changes" to apply them.
            </p>
          )}
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h5 className="text-sm font-medium">Permission Notes:</h5>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Visible:</strong> Client can see this section in the sidebar</li>
            <li>• Admins and members always have full access regardless of these settings</li>
            <li>• Settings section is typically hidden for clients</li>
            <li>• Unchecked sections will be completely hidden from the client's sidebar</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
} 