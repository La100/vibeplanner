"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Image from "next/image";
import { 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  Trash2, 
  Download,
  Eye,
  FolderOpen,
  FolderPlus,
  ArrowLeft
} from "lucide-react";

import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function FilesView() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const [currentFolderId, setCurrentFolderId] = useState<Id<"folders"> | undefined>(undefined);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [fileForPreview, setFileForPreview] = useState<{
    _id: string;
    name: string;
    fileType: string;
    url: string | null;
    _creationTime: number;
  } | null>(null);

  const project = useQuery(api.myFunctions.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const content = useQuery(
    api.files.getProjectContent,
    project ? { projectId: project._id, folderId: currentFolderId } : "skip"
  );

  const currentFolder = useQuery(
    api.files.getFolder,
    currentFolderId ? { folderId: currentFolderId } : "skip"
  );

  const hasAccess = useQuery(api.myFunctions.checkUserProjectAccess, 
    project ? { projectId: project._id } : "skip"
  );

  const generateUploadUrl = useMutation(api.files.generateUploadUrlWithCustomKey);
  const attachFile = useMutation(api.files.attachFileToProject);
  const createFolder = useMutation(api.files.createFolder);
  const deleteFile = useMutation(api.files.deleteFile);
  const deleteFolder = useMutation(api.files.deleteFolder);

  if (project === undefined || content === undefined || hasAccess === undefined || 
      (currentFolderId && currentFolder === undefined)) {
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
      // 1. Generate upload URL with custom folder structure
      const uploadData = await generateUploadUrl({
        projectId: project!._id,
        fileName: file.name,
      });

      // 2. Upload file to R2 using the presigned URL
      const response = await fetch(uploadData.url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      // 3. Extract the file key from the URL (everything after the last slash and before query params)
      const fileKey = uploadData.key;
      
      // 4. Attach file to project
      await attachFile({
        projectId: project!._id,
        folderId: currentFolderId,
        fileKey,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      toast.success("File uploaded successfully");
      event.target.value = ""; // Reset file input
    } catch (error) {
      toast.error("Failed to upload file", {
        description: (error as Error).message
      });
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await createFolder({
        projectId: project!._id,
        name: newFolderName.trim(),
        parentFolderId: currentFolderId,
      });

      toast.success("Folder created successfully");
      setNewFolderName("");
      setShowCreateFolder(false);
    } catch (error) {
      toast.error("Failed to create folder", {
        description: (error as Error).message
      });
    }
  };

  const handleDeleteFile = async (fileId: Id<"files">) => {
    try {
      await deleteFile({ fileId });
      toast.success("File deleted successfully");
    } catch (error) {
      toast.error("Failed to delete file", {
        description: (error as Error).message
      });
    }
  };

  const handleDeleteFolder = async (folderId: Id<"folders">) => {
    try {
      await deleteFolder({ folderId });
      toast.success("Folder deleted successfully");
    } catch (error) {
      toast.error("Failed to delete folder", {
        description: (error as Error).message
      });
    }
  };

  const getFileTypeIcon = (fileType: string) => {
    if (fileType === "image") return <ImageIcon className="h-8 w-8" />;
    if (fileType === "document") return <FileText className="h-8 w-8" />;
    return <FileText className="h-8 w-8" />;
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {currentFolderId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentFolderId(undefined)}
                className="p-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-3xl font-bold">
              {project.name} - Files
              {currentFolder && ` / ${currentFolder.name}`}
            </h1>
          </div>
          <p className="text-muted-foreground">Organize your project files in folders</p>
        </div>
        
        {/* Delete folder button when inside a folder */}
        {currentFolderId && currentFolder && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:bg-red-50 border-red-200"
            onClick={() => {
              handleDeleteFolder(currentFolderId);
              setCurrentFolderId(currentFolder.parentFolderId);
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Folder
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4 mb-6">
        <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>
                Create a new folder to organize your files.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                  Create Folder
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="relative">
          <input
            type="file"
            onChange={handleFileUpload}
            accept="image/*,application/pdf,.dwg,.dxf,.doc,.docx"
            className="absolute inset-0 opacity-0 cursor-pointer"
            id="file-upload"
          />
          <Button asChild>
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </label>
          </Button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {/* Folders */}
        {content.folders.map((folder) => (
          <Card 
            key={folder._id} 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setCurrentFolderId(folder._id)}
          >
            <CardContent className="p-4 text-center">
              <div className="flex flex-col items-center space-y-2">
                <FolderOpen className="h-12 w-12 text-blue-500" />
                <h3 className="font-medium text-sm truncate w-full" title={folder.name}>
                  {folder.name}
                </h3>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Files */}
        {content.files.map((file) => (
          <Card key={file._id} className="group hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                {file.fileType === "image" && file.url ? (
                  <Image
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover cursor-pointer"
                    width={100}
                    height={100}
                    onClick={() => setFileForPreview(file)}
                  />
                ) : (
                  <div className="text-gray-400">
                    {getFileTypeIcon(file.fileType)}
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
                  {file.size > 0 && (
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

      {/* Empty State */}
      {content.folders.length === 0 && content.files.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-gray-400 mb-4">
            <FolderOpen className="h-12 w-12 mx-auto" />
          </div>
          <p className="text-muted-foreground mb-4">
            This folder is empty. Create a folder or upload files to get started.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setShowCreateFolder(true)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Create Folder
            </Button>
            <Button asChild>
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </label>
            </Button>
          </div>
        </Card>
      )}

      {/* File Preview Dialog */}
      <Dialog open={!!fileForPreview} onOpenChange={() => setFileForPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{fileForPreview?.name}</DialogTitle>
            <DialogDescription>
              {fileForPreview?.fileType} - Uploaded {fileForPreview && formatDistanceToNow(new Date(fileForPreview._creationTime), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {fileForPreview?.fileType === 'image' && fileForPreview?.url && (
              <Image
                src={fileForPreview.url}
                alt={fileForPreview.name}
                className="max-w-full max-h-full object-contain mx-auto"
                width={800}
                height={800}
              />
            )}
            {fileForPreview?.fileType === 'document' && fileForPreview?.url && (
              <iframe 
                src={`https://docs.google.com/gview?url=${encodeURIComponent(fileForPreview.url)}&embedded=true`} 
                className="w-full h-full" 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 