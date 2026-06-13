"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { api } from "@/trpc/react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import toast from "react-hot-toast";
import { Upload, X, Image as ImageIcon } from "lucide-react";

interface ImageUploadProps {
  uploadPrefix: string; // Server-derived, e.g. "venue-1/" — NEVER construct from client-side props
  currentPath: string | null;
  onUploadComplete: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ImageUpload({
  uploadPrefix,
  currentPath,
  onUploadComplete,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const confirmCoverUpload = api.venueManager.confirmCoverUpload.useMutation({
    onSuccess: (data) => {
      toast.success("Cover image updated");
      // Optionally delete old file from storage
      if (data.oldPath) {
        void deleteOldFile(data.oldPath);
      }
      onUploadComplete();
    },
    onError: (err) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const deleteImage = api.venueManager.deleteCoverImage.useMutation({
    onSuccess: async (data) => {
      if (data.deletedPath) {
        await deleteOldFile(data.deletedPath);
      }
      toast.success("Cover image removed");
      onUploadComplete();
    },
    onError: (err) => {
      toast.error(`Failed to remove: ${err.message}`);
    },
  });

  const deleteOldFile = async (path: string) => {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.storage.from("venue-covers").remove([path]);
    } catch (err) {
      console.error("Failed to delete old file:", err);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(0);

    try {
      const supabase = getSupabaseBrowserClient();

      // Generate unique filename using server-derived uploadPrefix
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${uploadPrefix}${timestamp}_${sanitizedName}`;

      // Simulate progress (Supabase SDK doesn't provide real progress)
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 90));
      }, 100);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("venue-covers")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      clearInterval(progressInterval);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setProgress(95);

      // Confirm upload in database
      await confirmCoverUpload.mutateAsync({ storagePath });

      setProgress(100);
    } catch (err) {
      toast.error(
        `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Client-side validation
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(
          "Invalid file type. Please upload a JPG, PNG, or WebP image",
        );
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error("File too large. Maximum file size is 5MB");
        return;
      }

      void uploadFile(file);
    },
    [uploadPrefix],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  const currentImageUrl = currentPath
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-covers/${currentPath}`
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cover Image</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Image Preview */}
        {currentImageUrl && (
          <div className="relative">
            <img
              src={currentImageUrl}
              alt="Current cover"
              className="h-40 w-full rounded-lg object-cover"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => deleteImage.mutate()}
              disabled={deleteImage.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Upload Dropzone */}
        <div
          {...getRootProps()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${isDragActive ? "border-blue-500 bg-blue-50" : "border-border hover:border-muted-foreground"} ${uploading ? "cursor-not-allowed opacity-50" : ""} `}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="w-full space-y-2">
              <div className="flex items-center justify-center">
                <Upload className="h-8 w-8 animate-pulse text-muted-foreground" />
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground">
                Uploading... {progress}%
              </p>
            </div>
          ) : (
            <>
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                {isDragActive
                  ? "Drop image here"
                  : "Drag & drop or click to upload"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG, WebP • Max 5MB
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
