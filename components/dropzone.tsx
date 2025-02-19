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
import { FFmpeg } from "@ffmpeg/ffmpeg";
import convertDocument from "@/utils/convert-document";

const extensions = {
  image: [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "webp",
    "ico",
    "tif",
    "tiff",
    "svg",
    "raw",
    "tga",
  ],
  video: [
    "mp4",
    "m4v",
    "mp4v",
    "3gp",
    "3g2",
    "avi",
    "mov",
    "wmv",
    "mkv",
    "flv",
    "ogv",
    "webm",
    "h264",
    "264",
    "hevc",
    "265",
  ],
  audio: ["mp3", "wav", "ogg", "aac", "wma", "flac", "m4a"],
  document: [
    "pdf",
    "doc",
    "docx",
    "txt",
    "rtf",
    "odt",
    "pages",
    "epub",
    "xls",
    "xlsx",
    "ppt",
    "pptx"
  ]
};

interface ConversionResult {
  url: string;
  output: string;
}

export default function Dropzone() {
  const { toast } = useToast();
  const [is_hover, setIsHover] = useState<boolean>(false);
  const [actions, setActions] = useState<Action[]>([]);
  const [is_ready, setIsReady] = useState<boolean>(false);
  const [files, setFiles] = useState<Array<any>>([]);
  const [is_loaded, setIsLoaded] = useState<boolean>(false);
  const [is_converting, setIsConverting] = useState<boolean>(false);
  const [is_done, setIsDone] = useState<boolean>(false);
  const ffmpegRef = useRef<any>(null);
  const [defaultValues, setDefaultValues] = useState<string>("video");
  const [selcted, setSelected] = useState<string>("...");
  const accepted_files = {
    "image/*": [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".ico",
      ".tif",
      ".tiff",
      ".raw",
      ".tga",
    ],
    "audio/*": [],
    "video/*": [],
    "application/pdf": [".pdf"],
    "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "text/plain": [".txt"],
    "application/rtf": [".rtf"],
    "application/vnd.oasis.opendocument.text": [".odt"],
    "application/vnd.ms-excel": [".xls"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "application/vnd.ms-powerpoint": [".ppt"],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"]
  };

  // functions
  const reset = () => {
    setIsDone(false);
    setActions([]);
    setFiles([]);
    setIsReady(false);
    setIsConverting(false);
  };
  const downloadAll = (): void => {
    for (let action of actions) {
      !action.is_error && download(action);
    }
  };
  const download = (action: Action) => {
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = action.url;
    a.download = action.output;

    document.body.appendChild(a);
    a.click();

    // Clean up after download
    URL.revokeObjectURL(action.url);
    document.body.removeChild(a);
  };
  const convert = async (): Promise<void> => {
    let tmp_actions = actions.map((elt) => ({
      ...elt,
      is_converting: true,
    }));
    setActions(tmp_actions);
    setIsConverting(true);
    
    for (let action of tmp_actions) {
      try {
        let result: ConversionResult;
        
        if (action.file_type.includes('pdf') || 
            action.file_type.includes('msword') || 
            action.file_type.includes('wordprocessingml') ||
            action.file_type.includes('text/plain')) {
          result = await convertDocument(action.file, action.to);
        } else {
          result = await convertFile(ffmpegRef.current, action);
        }
        
        tmp_actions = tmp_actions.map((elt) =>
          elt === action
            ? {
                ...elt,
                is_converted: true,
                is_converting: false,
                url: result.url,
                output: result.output,
              }
            : elt
        );
        setActions(tmp_actions);
      } catch (err) {
        console.error('Conversion error:', err);
        toast({
          variant: "destructive",
          title: "Error Converting File",
          description: err.message || "An error occurred during conversion",
          duration: 5000,
        });
        
        tmp_actions = tmp_actions.map((elt) =>
          elt === action
            ? {
                ...elt,
                is_converted: false,
                is_converting: false,
                is_error: true,
              }
            : elt
        );
        setActions(tmp_actions);
      }
    }
    setIsDone(true);
    setIsConverting(false);
  };
  const handleUpload = (data: Array<any>): void => {
    handleExitHover();
    setFiles(data);
    const tmp: Action[] = [];
    data.forEach((file: any) => {
      const formData = new FormData();
      const fileExtension = file.name.slice(((file.name.lastIndexOf(".") - 1) >>> 0) + 2);
      
      // Determine if it's a document type
      const isDocument = file.type.includes('pdf') || 
                        file.type.includes('msword') ||
                        file.type.includes('wordprocessingml') ||
                        file.type.includes('text/plain') ||
                        file.type.includes('application/rtf');

      tmp.push({
        file_name: file.name,
        file_size: file.size,
        from: fileExtension,
        to: null,
        file_type: file.type,
        file,
        is_converted: false,
        is_converting: false,
        is_error: false,
      });
    });
    setActions(tmp);
  };
  const handleHover = (): void => setIsHover(true);
  const handleExitHover = (): void => setIsHover(false);
  const updateAction = (file_name: String, to: String) => {
    setActions(
      actions.map((action): Action => {
        if (action.file_name === file_name) {
          console.log("FOUND");
          return {
            ...action,
            to,
          };
        }

        return action;
      })
    );
  };
  const checkIsReady = (): void => {
    let tmp_is_ready = true;
    actions.forEach((action: Action) => {
      if (!action.to) tmp_is_ready = false;
    });
    setIsReady(tmp_is_ready);
  };
  const deleteAction = (action: Action): void => {
    setActions(actions.filter((elt) => elt !== action));
    setFiles(files.filter((elt) => elt.name !== action.file_name));
  };
  useEffect(() => {
    if (!actions.length) {
      setIsDone(false);
      setFiles([]);
      setIsReady(false);
      setIsConverting(false);
    } else checkIsReady();
  }, [actions]);
  useEffect(() => {
    load();
  }, []);
  const load = async () => {
    const ffmpeg_response: FFmpeg = await loadFfmpeg();
    ffmpegRef.current = ffmpeg_response;
    setIsLoaded(true);
  };

  if (actions.length) {
    return (
      <div className="space-y-6">
        {actions.map((action: Action, i: any) => (
          <div
            key={i}
            className="relative flex flex-wrap items-center justify-between w-full px-4 py-4 space-y-2 border cursor-pointer lg:py-0 rounded-xl h-fit lg:h-20 lg:px-10 lg:flex-nowrap"
          >
            {!is_loaded && (
              <Skeleton className="absolute w-full h-full -ml-10 cursor-progress rounded-xl" />
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
                  value={action.to || ""}
                  onValueChange={(value) => updateAction(action.file_name, value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Convert to" />
                  </SelectTrigger>
                  <SelectContent className="h-fit">
                    {action.file_type.includes("image") && (
                      <Tabs defaultValue="image" className="w-full">
                        <TabsList className="w-full">
                          <TabsTrigger value="image" className="w-full">Image</TabsTrigger>
                          <TabsTrigger value="video" className="w-full">Video</TabsTrigger>
                          <TabsTrigger value="audio" className="w-full">Audio</TabsTrigger>
                        </TabsList>
                        <TabsContent value="image">
                          <div className="grid grid-cols-2 gap-2 w-fit">
                            {extensions.image.map((elt, i) => (
                              <div key={i} className="col-span-1 text-center">
                                <SelectItem value={elt} className="mx-auto">
                                  {elt}
                                </SelectItem>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                        <TabsContent value="video">
                          <div className="grid grid-cols-3 gap-2 w-fit">
                            {extensions.video.map((elt, i) => (
                              <div key={i} className="col-span-1 text-center">
                                <SelectItem value={elt} className="mx-auto">
                                  {elt}
                                </SelectItem>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                        <TabsContent value="audio">
                          <div className="grid grid-cols-3 gap-2 w-fit">
                            {extensions.audio.map((elt, i) => (
                              <div key={i} className="col-span-1 text-center">
                                <SelectItem value={elt} className="mx-auto">
                                  {elt}
                                </SelectItem>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      </Tabs>
                    )}
                    {(action.file_type.includes("pdf") || 
                      action.file_type.includes("msword") || 
                      action.file_type.includes("wordprocessingml") ||
                      action.file_type.includes("text/plain") ||
                      action.file_type.includes("application/rtf")) && (
                      <Tabs defaultValue="document" className="w-full">
                        <TabsList className="w-full">
                          <TabsTrigger value="document" className="w-full">Document</TabsTrigger>
                        </TabsList>
                        <TabsContent value="document">
                          <div className="grid grid-cols-3 gap-2 w-fit">
                            {extensions.document
                              .filter(ext => ext !== action.from) // Don't show current format
                              .map((elt, i) => (
                                <div key={i} className="col-span-1 text-center">
                                  <SelectItem value={elt} className="mx-auto">
                                    {elt}
                                  </SelectItem>
                                </div>
                            ))}
                          </div>
                        </TabsContent>
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
                onClick={() => deleteAction(action)}
                className="flex items-center justify-center w-10 h-10 text-2xl rounded-full cursor-pointer hover:bg-muted text-foreground"
              >
                <MdClose />
              </span>
            )}
          </div>
        ))}
        <div className="flex justify-end w-full">
          {is_done ? (
            <div className="space-y-4 w-fit">
              <Button
                size="lg"
                className="relative flex items-center w-full gap-2 py-4 font-semibold rounded-xl text-md"
                onClick={downloadAll}
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
      accept={accepted_files}
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
