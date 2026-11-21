
"use client";

import {
  Dropzone,
  DropZoneArea,
  DropzoneDescription,
  DropzoneFileList,
  DropzoneFileListItem,
  DropzoneMessage,
  DropzoneRemoveFile,
  DropzoneTrigger,
  useDropzone,
} from "@/components/ui/dropzone";

import { CloudUploadIcon, Trash2Icon } from "lucide-react";

export function DropBox() {
  const dropzone = useDropzone({
    onDropFile: async (file) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return {
        status: "success",
        result: URL.createObjectURL(file),
      };
    },

    validation: {
      accept: {
        "image/*": [".png", ".jpg", ".jpeg"],
        "video/*": [".mp4", ".webm", ".mov"],
      },
      maxSize: 1000 * 1024 * 1024,
      maxFiles: 10,
    },
  });

  return (
    <div className="not-prose flex flex-col gap-4">
      <Dropzone {...dropzone}>
        <div>
          <div className="flex justify-between">
            <DropzoneDescription>
              Upload up to 10 images or videos (Max 100 MB each)
            </DropzoneDescription>

            <DropzoneMessage />
          </div>

          <DropZoneArea className=" bg-black/10 border-background/50 hover:bg-gray-900 hover:border-background/70">
            <DropzoneTrigger className="flex flex-col items-center gap-4 bg-black/10 p-10 text-center text-sm">
              <CloudUploadIcon className="size-8" />

              <div>
                <p className="font-semibold">Upload media</p>
                <p className="text-sm text-muted-foreground">
                  Click here or drag and drop images/videos
                </p>
              </div>
            </DropzoneTrigger>
          </DropZoneArea>
        </div>

        <DropzoneFileList className="grid gap-3 p-0 md:grid-cols-2 lg:grid-cols-3">
          {dropzone.fileStatuses.map((file) => (
            <DropzoneFileListItem
              className="overflow-hidden rounded-md bg-foreground p-0 shadow-sm"
              key={file.id}
              file={file}
            >
              {file.status === "pending" && (
                <div className="aspect-video animate-pulse bg-black/20" />
              )}

              {file.status === "success" &&
                (file.file.type.startsWith("image/") ? (
                  <img
                    src={file.result}
                    alt={file.fileName}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <video
                    src={file.result}
                    controls
                    className="aspect-video w-full object-cover"
                  />
                ))}

              <div className="flex items-center justify-between p-2 pl-4">
                <div className="min-w-0">
                  <p className="truncate text-sm">{file.fileName}</p>

                  <p className="text-xs text-muted-foreground">
                    {(file.file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>

                <DropzoneRemoveFile
                  variant="ghost"
                  className="shrink-0 hover:outline"
                >
                  <Trash2Icon className="size-4" />
                </DropzoneRemoveFile>
              </div>
            </DropzoneFileListItem>
          ))}
        </DropzoneFileList>
      </Dropzone>
    </div>
  );
}
