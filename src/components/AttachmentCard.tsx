// src/components/AttachmentCard.tsx
import React, { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { filesize } from "filesize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Paperclip,
  Upload,
  Download,
  File as FileIcon,
  Loader2,
  X,
} from "lucide-react";
import { downloadAttachment } from "../services/api"; // <-- Import the new download function

// A generic interface for an attachment, usable by both PoCs and Projects
export interface Attachment {
  id: number;
  uuid: string;
  description: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
  uploadedBy: {
    id: number;
    name: string;
  };
}

// Define the props the component will accept
interface AttachmentCardProps {
  attachments: Attachment[];
  parentId: number;
  showUploader: boolean;
  onUploadSuccess: () => void;
  uploadFunction: (parentId: number, formData: FormData) => Promise<any>;
}

const AttachmentCard: React.FC<AttachmentCardProps> = ({
  attachments,
  parentId,
  showUploader,
  onUploadSuccess,
  uploadFunction,
}) => {
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [attachmentDescription, setAttachmentDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null); // To show a spinner on the correct button

  // --- NEW: Download handler function ---
  const handleDownload = async (attachment: Attachment) => {
    setDownloadingId(attachment.id);
    try {
      const blob = await downloadAttachment(attachment.uuid);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", attachment.originalFilename); // Use the original filename
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed", error);
      toast.error("Download failed. You may not have permission.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileToUpload(e.target.files[0]);
    }
  };

  const handleUploadAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload || !attachmentDescription.trim()) {
      toast.warning("Please select a file and provide a description.");
      return;
    }

    const formData = new FormData();
    formData.append("file", fileToUpload);
    formData.append("description", attachmentDescription);

    setIsUploading(true);
    try {
      await uploadFunction(parentId, formData);
      toast.success("Attachment uploaded successfully!");
      setFileToUpload(null);
      setAttachmentDescription("");
      onUploadSuccess();
    } catch (error) {
      console.error("Failed to upload attachment", error);
      toast.error("Failed to upload attachment.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <Paperclip className="w-5 h-5 mr-2 text-indigo-600" />
          Attachments
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Attachment List */}
        <div className="space-y-3">
          {attachments && attachments.length > 0 ? (
            attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md border"
              >
                <div className="flex items-center space-x-3">
                  <FileIcon className="h-6 w-6 text-gray-400 flex-shrink-0" />
                  <div className="flex-grow overflow-hidden">
                    <p className="font-medium text-gray-800 truncate">
                      {att.originalFilename}
                    </p>
                    <p className="text-sm text-gray-600">{att.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {filesize(att.fileSizeBytes)} &bull; Uploaded by{" "}
                      {att.uploadedBy.name} &bull;{" "}
                      {formatDistanceToNow(parseISO(att.createdAt))} ago
                    </p>
                  </div>
                </div>
                {/* --- UPDATED: Use a Button with an onClick handler --- */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(att)}
                  disabled={downloadingId === att.id}
                  className="ml-4"
                >
                  {downloadingId === att.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="h-4 w-4 md:mr-2" />
                      <span className="hidden md:inline">Download</span>
                    </>
                  )}
                </Button>
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-gray-500 py-4">
              No attachments yet.
            </p>
          )}
        </div>

        {/* Upload Form */}
        {showUploader && (
          <form
            onSubmit={handleUploadAttachment}
            className="mt-6 pt-6 border-t"
          >
            <h3 className="text-lg font-medium mb-3">Upload New Attachment</h3>
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Attachment description..."
                value={attachmentDescription}
                onChange={(e) => setAttachmentDescription(e.target.value)}
                required
              />
              {fileToUpload ? (
                <div className="flex items-center justify-between p-2 border rounded-md bg-gray-50">
                  <span className="text-sm font-medium truncate">
                    {fileToUpload.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFileToUpload(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Input type="file" onChange={handleFileSelect} required />
              )}
              <Button
                type="submit"
                disabled={isUploading}
                className="w-full sm:w-auto"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {isUploading ? "Uploading..." : "Upload File"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default AttachmentCard;
