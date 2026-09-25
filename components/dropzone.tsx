"use client";
import { FiUploadCloud } from "react-icons/fi";
import { LuFileSymlink } from "react-icons/lu";
import { MdClose } from "react-icons/md";
import ReactDropzone from "react-dropzone";
import bytesToSize from "@/utils/bytes-to-size";
import fileToIcon from "@/utils/file-to-icon";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import compressFileName from "@/utils/compress-file-name";
import { Skeleton } from "@/components/ui/skeleton";
import convertFile from "@/utils/convert";
import { ImSpinner3 } from "react-icons/im";
import { MdDone } from "react-icons/md";
import { Badge } from "@/components/ui/badge";
import { HiOutlineDownload } from "react-icons/hi";
import { BiError } from "react-icons/bi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import loadFfmpeg from "@/utils/load-ffmpeg";
import type { Action } from "@/types";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import convertDocument from "@/utils/convert-document";
import {
  acceptedFiles,
  detectCategory,
  getExtension,
  targetsFor,
} from "@/utils/formats";

const tabLabels: Record<string, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  document: "Document",
};

export default function Dropzone() {
  const { toast } = useToast();
  const [is_hover, setIsHover] = useState<boolean>(false);
  const [actions, setActions] = useState<Action[]>([]);
  const [is_loaded, setIsLoaded] = useState<boolean>(false);
  const [load_error, setLoadError] = useState<string | null>(null);
  const [is_converting, setIsConverting] = useState<boolean>(false);
  const [is_done, setIsDone] = useState<boolean>(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const is_ready = actions.length > 0 && actions.every((a) => !!a.to);

  // functions
  const revokeUrls = (list: Action[]) =>
    list.forEach((a) => a.url && URL.revokeObjectURL(a.url));
  const reset = () => {
    revokeUrls(actions);
    setIsDone(false);
    setActions([]);
    setIsConverting(false);
  };
  const download = (action: Action) => {
    if (!action.url || !action.output) return;
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = action.url;
    a.download = action.output;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // URL stays valid so the file can be downloaded again; revoked on reset
  };
  const downloadAll = (): void => {
    actions.forEach((action, i) => {
      if (action.is_converted) setTimeout(() => download(action), i * 300);
    });
  };
  const convert = async (): Promise<void> => {
    let tmp_actions = actions.map((elt) =>
      elt.is_converted ? elt : { ...elt, is_converting: true, is_error: false },
    );
    setActions(tmp_actions);
    setIsConverting(true);

    for (let i = 0; i < tmp_actions.length; i++) {
      const action = tmp_actions[i];
      if (action.is_converted) continue;
      try {
        if (!action.to) throw new Error("Please select a format to convert to");

        let result: { url: string; output: string };
        if (action.category === "document") {
          result = await convertDocument(action.file, action.to);
        } else {
          if (!ffmpegRef.current)
            throw new Error(
              load_error
                ? "The converter engine failed to load. Reload the page and try again."
                : "The converter engine is still loading, try again in a moment.",
            );
          result = await convertFile(ffmpegRef.current, action);
        }

        tmp_actions = tmp_actions.map((elt, j) =>
          j === i
            ? { ...elt, is_converted: true, is_converting: false, url: result.url, output: result.output }
            : elt,
        );
      } catch (error: unknown) {
        console.error("Conversion error:", error);
        toast({
          variant: "destructive",
          title: `Error converting ${action.file_name}`,
          description: error instanceof Error ? error.message : "An error occurred during conversion",
          duration: 6000,
        });
        tmp_actions = tmp_actions.map((elt, j) =>
          j === i ? { ...elt, is_converted: false, is_converting: false, is_error: true } : elt,
        );
        // a crashed/aborted ffmpeg instance is unusable — start a fresh one
        if (action.category !== "document" && ffmpegRef.current) {
          try {
            ffmpegRef.current.terminate();
          } catch {}
          ffmpegRef.current = null;
          try {
            ffmpegRef.current = await loadFfmpeg();
          } catch (e) {
            setLoadError(e instanceof Error ? e.message : String(e));
          }
        }
      }
      setActions(tmp_actions);
    }
    setIsDone(true);
    setIsConverting(false);
  };
  const handleUpload = (data: File[]): void => {
    handleExitHover();
    const tmp: Action[] = [];
    const rejected: string[] = [];
    data.forEach((file) => {
      const category = detectCategory(file);
      if (!category) {
        rejected.push(file.name);
        return;
      }
      tmp.push({
        file_name: file.name,
        file_size: file.size,
        from: getExtension(file.name),
        to: null,
        file_type: file.type || category,
        category,
        file,
        is_converted: false,
        is_converting: false,
        is_error: false,
      });
    });
    if (rejected.length)
      toast({
        variant: "destructive",
        title: "Unsupported file(s)",
        description: rejected.join(", "),
        duration: 5000,
      });
    setActions(tmp);
  };
  const handleHover = (): void => setIsHover(true);
  const handleExitHover = (): void => setIsHover(false);
  const updateAction = (index: number, to: string) => {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, to } : a)));
  };
  const deleteAction = (index: number): void => {
    setActions((prev) => {
      revokeUrls([prev[index]]);
      return prev.filter((_, i) => i !== index);
    });
  };
  useEffect(() => {
    if (!actions.length) {
      setIsDone(false);
      setIsConverting(false);
    }
  }, [actions]);
  useEffect(() => {
    let cancelled = false;
    loadFfmpeg()
      .then((ffmpeg) => {
        if (cancelled) return;
        ffmpegRef.current = ffmpeg;
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load ffmpeg:", err);
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (actions.length) {
    return (
      <div className="space-y-6">
        {load_error && actions.some((a) => a.category !== "document") && (
          <p className="text-sm text-destructive">
            The media converter failed to load ({load_error}). Documents still work — reload the page to retry.
          </p>
        )}
        {actions.map((action: Action, i: number) => {
          const targets = targetsFor(action.category, action.from);
          const groups = Object.entries(targets).filter(([, list]) => list.length);
          const waiting = action.category !== "document" && !is_loaded && !load_error;
          return (
          <div
            key={`${action.file_name}-${i}`}
            className="relative flex flex-wrap items-center justify-between w-full px-4 py-4 space-y-2 border lg:py-0 rounded-xl h-fit lg:h-20 lg:px-10 lg:flex-nowrap"
          >
            {waiting && (
              <Skeleton className="absolute inset-0 cursor-progress rounded-xl" />
            )}
            <div className="flex items-center gap-4">
              <span className="text-2xl text-orange-600">
                {fileToIcon(action.file_type)}
              </span>
              <div className="flex items-center gap-1 w-96">
                <span className="overflow-x-hidden font-medium text-md">
                  {compressFileName(action.file_name)}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({bytesToSize(action.file_size)})
                </span>
              </div>
            </div>

            {action.is_error ? (
              <Badge variant="destructive" className="flex gap-2">
                <span>Error Converting File</span>
                <BiError />
              </Badge>
            ) : action.is_converted ? (
              <Badge variant="default" className="flex gap-2 bg-green-500">
                <span>Done</span>
                <MdDone />
              </Badge>
            ) : action.is_converting ? (
              <Badge variant="default" className="flex gap-2">
                <span>Converting</span>
                <span className="animate-spin">
                  <ImSpinner3 />
                </span>
              </Badge>
            ) : (
              <div className="flex items-center gap-4 text-muted-foreground text-md">
                <span>Convert to</span>
                <Select
                  value={action.to ?? ""}
                  onValueChange={(value: string) => updateAction(i, value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="..." />
                  </SelectTrigger>
                  <SelectContent className="h-fit">
                    {groups.length === 0 ? (
                      <p className="p-2 text-sm">No conversions available</p>
                    ) : (
                      <Tabs defaultValue={groups[0][0]} className="w-full">
                        {groups.length > 1 && (
                          <TabsList className="w-full">
                            {groups.map(([key]) => (
                              <TabsTrigger key={key} value={key} className="w-full">
                                {tabLabels[key]}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        )}
                        {groups.map(([key, list]) => (
                          <TabsContent key={key} value={key}>
                            <div className="grid grid-cols-3 gap-2 w-fit">
                              {list.map((elt) => (
                                <div key={elt} className="col-span-1 text-center">
                                  <SelectItem value={elt} className="mx-auto">
                                    {elt}
                                  </SelectItem>
                                </div>
                              ))}
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {action.is_converted ? (
              <Button variant="outline" onClick={() => download(action)}>
                Download
              </Button>
            ) : (
              <span
                onClick={() => !is_converting && deleteAction(i)}
                className="flex items-center justify-center w-10 h-10 text-2xl rounded-full cursor-pointer hover:bg-muted text-foreground"
              >
                <MdClose />
              </span>
            )}
          </div>
          );
        })}
        <div className="flex justify-end w-full">
          {is_done ? (
            <div className="space-y-4 w-fit">
              <Button
                size="lg"
                className="relative flex items-center w-full gap-2 py-4 font-semibold rounded-xl text-md"
                onClick={downloadAll}
                disabled={!actions.some((a) => a.is_converted)}
              >
                {actions.length > 1 ? "Download All" : "Download"}
                <HiOutlineDownload />
              </Button>
              <Button
                size="lg"
                onClick={reset}
                variant="outline"
                className="rounded-xl"
              >
                Convert Another File(s)
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              disabled={!is_ready || is_converting}
              className="relative flex items-center py-4 font-semibold rounded-xl text-md w-44"
              onClick={convert}
            >
              {is_converting ? (
                <span className="text-lg animate-spin">
                  <ImSpinner3 />
                </span>
              ) : (
                <span>Convert Now</span>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <ReactDropzone
      onDrop={handleUpload}
      onDragEnter={handleHover}
      onDragLeave={handleExitHover}
      accept={acceptedFiles}
      onDropRejected={() => {
        handleExitHover();
        toast({
          variant: "destructive",
          title: "Error uploading your file(s)",
          description: "Allowed Files: Audio, Video, Images, and Documents (PDF, Word, etc.)",
          duration: 5000,
        });
      }}
      onError={() => {
        handleExitHover();
        toast({
          variant: "destructive",
          title: "Error uploading your file(s)",
          description: "Allowed Files: Audio, Video, Images, and Documents (PDF, Word, etc.)",
          duration: 5000,
        });
      }}
    >
      {({ getRootProps, getInputProps }) => (
        <div
          {...getRootProps()}
          className="flex items-center justify-center border-2 border-dashed shadow-sm cursor-pointer bg-background h-72 lg:h-80 xl:h-96 rounded-3xl border-secondary"
        >
          <input {...getInputProps()} />
          <div className="space-y-4 text-foreground">
            {is_hover ? (
              <>
                <div className="flex justify-center text-6xl">
                  <LuFileSymlink />
                </div>
                <h3 className="text-2xl font-medium text-center">
                  Yes, right there
                </h3>
              </>
            ) : (
              <>
                <div className="flex justify-center text-6xl">
                  <FiUploadCloud />
                </div>
                <h3 className="text-2xl font-medium text-center">
                  Click, or drop your files here
                </h3>
              </>
            )}
          </div>
        </div>
      )}
    </ReactDropzone>
  );
}
