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
    // h263 only allows fixed frame sizes — fit into 352x288 and letterbox, keeping the aspect ratio
    cmd = ["-i", input, "-r", "20",
      "-vf", "scale=352:288:force_original_aspect_ratio=decrease,pad=352:288:(ow-iw)/2:(oh-ih)/2,setsar=1",
      "-vb", "400k", "-acodec", "aac", "-ac", "1", "-ar", "8000", "-ab", "24k", tmpOutput];
  else if (to === "webm")
    // VP9 crashes in ffmpeg.wasm (out of memory) — VP8 + Vorbis is stable
    cmd = ["-i", input, "-c:v", "libvpx", "-b:v", "1M", "-deadline", "realtime", "-cpu-used", "8",
      "-c:a", "libvorbis", tmpOutput];
  else if (to === "flv")
    // FLV only allows 44.1/22.05/11.025 kHz audio (3gp sources are 8 kHz)
    cmd = ["-i", input, "-ar", "44100", tmpOutput];
  else if (action.category === "video" && to === "gif")
    cmd = ["-i", input, "-vf", "fps=12,scale=480:-1:flags=lanczos", tmpOutput];
  else if (action.category === "video" && audioTargets.includes(to))
    cmd = ["-i", input, "-vn", tmpOutput]; // extract audio track
  else if (isImage && getExtension(file_name) === "gif" && to === "webp")
    cmd = ["-i", input, "-loop", "0", tmpOutput]; // keep the animation
  else if (isImage) {
    // single frame; mjpeg needs a yuvj pixel format, otherwise the wasm build hangs,
    // and the default optimal huffman tables crash it (memory access out of bounds)
    const extra =
      to === "jpg" || to === "jpeg" ? ["-pix_fmt", "yuvj420p", "-q:v", "2", "-huffman", "default"]
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
      if (log.includes("does not contain any stream"))
        throw new Error(action.category === "video" && audioTargets.includes(to)
          ? "This video has no audio track to extract"
          : "The file contains no usable stream for this format");
      // skip ffmpeg's generic trailer lines so the actual cause is shown
      const last = log.trim().split("\n")
        .filter((l) => l.trim() && !/^(Aborted\(\)|Conversion failed!)$/.test(l.trim()))
        .pop() ?? "";
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
