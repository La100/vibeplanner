"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { 
  Upload, 
  Image, 
  FileText, 
  Trash2, 
  Download,
  Eye,
  FolderOpen
} from "lucide-react";
import { useUploadFile } from "@convex-dev/r2/react";
import { toast } from "sonner";

type FileCategory = "inspiration" | "moodboard" | "floor_plan" | "technical_drawing" | "product_photo" | "client_photo" | "progress_photo" | "document" | "other";

const fileCategories: { value: FileCategory; label: string; icon: string }[] = [
  { value: "inspiration", label: "Inspiration", icon: "💡" },
  { value: "moodboard", label: "Mood Board", icon: "🎨" },
  { value: "floor_plan", label: "Floor Plan", icon: "📐" },
  { value: "technical_drawing", label: "Technical Drawing", icon: "📋" },
  { value: "product_photo", label: "Product Photo", icon: "📦" },
  { value: "client_photo", label: "Client Photo", icon: "📸" },
  { value: "progress_photo", label: "Progress Photo", icon: "🏠" },
  { value: "document", label: "Document", icon: "📄" },
  { value: "other", label: "Other", icon: "📁" },
];

const roomCategories = [
  "Living Room", "Kitchen", "Master Bedroom", "Guest Bedroom", 
  "Bathroom", "Home Office", "Dining Room", "Entryway", "Outdoor"
];

export default function FilesView() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>("inspiration");
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<FileCategory | "all">("all");

  const project = useQuery(api.myFunctions.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const files = useQuery(api.files.getProjectFiles, 
    project ? { projectId: project._id } : "skip"
  );

  const hasAccess = useQuery(api.myFunctions.checkUserProjectAccess, 
    project ? { projectId: project._id } : "skip"
  );

  const uploadFile = useUploadFile(api.files);
  const attachFile = useMutation(api.files.attachFileToProject);
  const deleteFile = useMutation(api.files.deleteFile);

  if (project === undefined || files === undefined || hasAccess === undefined) {
    return <div>Loading...</div>;
  }

  if (project === null) {
    return <div>Project not found.</div>;
  }

  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to access this project.</p>
      </div>
    );
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Upload file to R2
      const fileKey = await uploadFile(file);
      
      // Attach file to project
      await attachFile({
        projectId: project!._id,
        fileKey,
        fileName: file.name,
        fileType: file.type,
        category: selectedCategory,
        roomCategory: selectedRoom === "all" ? undefined : selectedRoom,
      });

      toast.success("File uploaded successfully");
      event.target.value = ""; // Reset file input
    } catch (error) {
      toast.error("Failed to upload file", {
        description: (error as Error).message
      });
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteFile({ fileId: fileId as any });
      toast.success("File deleted successfully");
    } catch (error) {
      toast.error("Failed to delete file", {
        description: (error as Error).message
      });
    }
  };

  const filteredFiles = files?.filter(file => {
    if (filterCategory === "all") return true;
    // Since we don't have category in the file schema, we'll filter by fileType for now
    return true; // TODO: Add proper filtering when category is added to schema
  }) || [];

  const getCategoryIcon = (fileType: string) => {
    if (fileType === "image") return <Image className="h-4 w-4" />;
    if (fileType === "document") return <FileText className="h-4 w-4" />;
    return <FolderOpen className="h-4 w-4" />;
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{project.name} - Files</h1>
          <p className="text-muted-foreground">Manage project files and inspiration</p>
        </div>
      </div>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <Select value={selectedCategory} onValueChange={(value: FileCategory) => setSelectedCategory(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fileCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.icon} {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Room (Optional)</label>
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {roomCategories.map((room) => (
                    <SelectItem key={room} value={room}>
                      {room}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="w-full">
                <label className="block text-sm font-medium mb-2">Choose File</label>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf,.dwg,.dxf,.doc,.docx"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Section */}
      <div className="flex gap-4 mb-6">
        <Select value={filterCategory} onValueChange={(value: FileCategory | "all") => setFilterCategory(value)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {fileCategories.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.icon} {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Files Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredFiles.map((file) => (
          <Card key={file._id} className="group hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                {file.fileType === "image" && file.url ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-400">
                    {getCategoryIcon(file.fileType)}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium text-sm truncate" title={file.name}>
                  {file.name}
                </h3>
                
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {file.fileType}
                  </Badge>
                  {file.size && (
                    <Badge variant="outline" className="text-xs">
                      {(file.size / 1024 / 1024).toFixed(1)}MB
                    </Badge>
                  )}
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {file.url && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => window.open(file.url, '_blank')}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = file.url!;
                          a.download = file.name;
                          a.click();
                        }}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteFile(file._id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredFiles.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-gray-400 mb-4">
            <FolderOpen className="h-12 w-12 mx-auto" />
          </div>
          <p className="text-muted-foreground">
            No files uploaded yet. Upload your first file to get started.
          </p>
        </Card>
      )}
    </div>
  );
} 