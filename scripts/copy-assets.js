// Copies runtime assets (ffmpeg.wasm core, PDF.js worker) from node_modules to /public,
// so the app does not depend on a third-party CDN and versions always match.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pub = path.join(root, "public");

function copy(from, to) {
  const src = path.join(root, "node_modules", from);
  const dest = path.join(pub, to);
  if (!fs.existsSync(src)) {
    console.warn(`[copy-assets] missing ${from}, skipping`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

copy("@ffmpeg/core/dist/umd/ffmpeg-core.js", "ffmpeg/ffmpeg-core.js");
copy("@ffmpeg/core/dist/umd/ffmpeg-core.wasm", "ffmpeg/ffmpeg-core.wasm");
copy("pdfjs-dist/build/pdf.worker.min.js", "pdf.worker.min.js");
