import type { Action } from "@/types";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { getExtension, mimeFor, removeExtension } from "@/utils/formats";

let counter = 0;

export default async function convert(
  ffmpeg: FFmpeg,
  action: Action,
): Promise<{ url: string; output: string }> {
  const { file, file_name } = action;
  const to = String(action.to);
  const id = ++counter;
  // unique names inside the in-memory FS, so files never collide
  const input = `in_${id}.${getExtension(file_name) || "bin"}`;
  const tmpOutput = `out_${id}.${to}`;
  const output = `${removeExtension(file_name)}.${to}`;

  await ffmpeg.writeFile(input, await fetchFile(file));

  const isImage = action.category === "image";
  const audioTargets = ["mp3", "wav", "ogg", "aac", "flac", "m4a", "wma"];

  let cmd: string[];
  if (to === "3gp" || to === "3g2")
    cmd = ["-i", input, "-r", "20", "-s", "352x288", "-vb", "400k", "-acodec", "aac",
      "-ac", "1", "-ar", "8000", "-ab", "24k", tmpOutput];
  else if (to === "webm")
    // VP9 crashes in ffmpeg.wasm (out of memory) — VP8 + Vorbis is stable
    cmd = ["-i", input, "-c:v", "libvpx", "-b:v", "1M", "-deadline", "realtime", "-cpu-used", "8",
      "-c:a", "libvorbis", tmpOutput];
  else if (action.category === "video" && to === "gif")
    cmd = ["-i", input, "-vf", "fps=12,scale=480:-1:flags=lanczos", tmpOutput];
  else if (action.category === "video" && audioTargets.includes(to))
    cmd = ["-i", input, "-vn", tmpOutput]; // extract audio track
  else if (isImage) {
    // single frame; mjpeg needs a yuvj pixel format, otherwise the wasm build hangs
    const extra =
      to === "jpg" || to === "jpeg" ? ["-pix_fmt", "yuvj420p", "-q:v", "2"]
      : to === "ico" ? ["-vf", "scale='min(256,iw)':'min(256,ih)':force_original_aspect_ratio=decrease"]
      : [];
    cmd = ["-i", input, "-frames:v", "1", "-update", "1", ...extra, tmpOutput];
  } else cmd = ["-i", input, tmpOutput];

  let log = "";
  const onLog = ({ message }: { message: string }) => { log = (log + "\n" + message).slice(-2000); };
  ffmpeg.on("log", onLog);
  let code: number;
  try {
    code = await ffmpeg.exec(cmd, isImage ? 60_000 : -1);
  } finally {
    ffmpeg.off("log", onLog);
  }

  try {
    if (code !== 0) {
      const last = log.trim().split("\n").filter(Boolean).pop() ?? "";
      throw new Error(`ffmpeg failed (${code})${last ? ": " + last : ""}`);
    }
    const data = (await ffmpeg.readFile(tmpOutput)) as Uint8Array;
    const blob = new Blob([data], { type: mimeFor(to) });
    return { url: URL.createObjectURL(blob), output };
  } finally {
    await ffmpeg.deleteFile(input).catch(() => {});
    await ffmpeg.deleteFile(tmpOutput).catch(() => {});
  }
}
