import type { Category } from "@/types";

// Formats the bundled ffmpeg.wasm core can actually encode
export const extensions = {
  image: ["jpg", "jpeg", "png", "gif", "bmp", "webp", "ico", "tif", "tiff", "tga"],
  video: ["mp4", "m4v", "mov", "avi", "mkv", "webm", "flv", "ogv", "wmv", "3gp", "3g2"],
  audio: ["mp3", "wav", "ogg", "aac", "flac", "m4a", "wma"],
  document: ["pdf", "docx", "txt"],
};

// Which target formats each document type can be converted to
export const documentTargets: Record<string, string[]> = {
  pdf: ["docx", "txt"],
  docx: ["pdf", "txt"],
  txt: ["pdf", "docx"],
};

export const acceptedFiles = {
  "image/*": extensions.image.map((e) => "." + e),
  "video/*": [...extensions.video.map((e) => "." + e), ".mpeg", ".mpg", ".ts"],
  "audio/*": [...extensions.audio.map((e) => "." + e), ".opus", ".aiff"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
};

export function getExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

export function removeExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? name : name.slice(0, i);
}

// Uses the extension first — browsers often report an empty or wrong MIME type
export function detectCategory(file: File): Category | null {
  const ext = getExtension(file.name);
  if (ext in documentTargets) return "document";
  if (extensions.image.includes(ext) || file.type.startsWith("image/")) return "image";
  if (extensions.audio.includes(ext) || file.type.startsWith("audio/")) return "audio";
  if (extensions.video.includes(ext) || file.type.startsWith("video/")) return "video";
  return null;
}

export function targetsFor(category: Category | null, from: string): Record<string, string[]> {
  const without = (list: string[]) => list.filter((e) => e !== from);
  switch (category) {
    case "image":
      return { image: without(extensions.image) };
    case "video":
      return { video: [...without(extensions.video), "gif"], audio: extensions.audio };
    case "audio":
      return { audio: without(extensions.audio) };
    case "document":
      return { document: documentTargets[from] ?? [] };
    default:
      return {};
  }
}

const mimeOverrides: Record<string, string> = {
  jpg: "image/jpeg", tif: "image/tiff", ico: "image/x-icon", tga: "image/x-tga",
  mp3: "audio/mpeg", m4a: "audio/mp4", wma: "audio/x-ms-wma",
  m4v: "video/x-m4v", mov: "video/quicktime", avi: "video/x-msvideo", mkv: "video/x-matroska",
  flv: "video/x-flv", ogv: "video/ogg", wmv: "video/x-ms-wmv", "3gp": "video/3gpp", "3g2": "video/3gpp2",
};

export function mimeFor(ext: string): string {
  if (mimeOverrides[ext]) return mimeOverrides[ext];
  if (extensions.image.includes(ext)) return `image/${ext}`;
  if (extensions.audio.includes(ext)) return `audio/${ext}`;
  if (extensions.video.includes(ext)) return `video/${ext}`;
  return "application/octet-stream";
}
