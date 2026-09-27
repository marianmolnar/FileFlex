import { getExtension, removeExtension } from "@/utils/formats";

// Heavy libraries are loaded on demand, only in the browser
async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items as any[]) {
      if (typeof item.str !== "string") continue;
      text += item.str + (item.hasEOL ? "\n" : " ");
    }
    pages.push(text.replace(/[ \t]+\n/g, "\n").trim());
  }
  return pages.join("\n\n");
}

async function extractDocxText(data: ArrayBuffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ arrayBuffer: data });
  return value;
}

async function textToPdf(text: string): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fetchFont = async (url: string) => {
    const bytes = await fetch(url).then((r) => r.arrayBuffer());
    return { bytes, glyphs: fontkit.create(new Uint8Array(bytes)) };
  };
  // Unicode font, so diacritics (č, ř, ž…) work — standard PDF fonts only cover WinAnsi
  const primary = await fetchFont("/fonts/DejaVuSans.ttf");
  const fonts = [{ ...primary, font: await pdf.embedFont(primary.bytes, { subset: true }) }];
  const has = (i: number, ch: string) => fonts[i].glyphs.hasGlyphForCodePoint(ch.codePointAt(0)!);
  const chars = Array.from(new Set(text));
  // CJK fonts are large, so they are only fetched and embedded when the text needs them.
  // pdf-lib's subsetting drops glyphs from these fonts, so they are embedded whole.
  let missing = chars.filter((ch) => ch.trim() && !has(0, ch));
  for (const url of ["/fonts/DroidSansFallbackFull.ttf", "/fonts/NanumGothic-Regular.ttf"]) {
    if (!missing.length) break;
    const fallback = await fetchFont(url);
    const covered = missing.filter((ch) => fallback.glyphs.hasGlyphForCodePoint(ch.codePointAt(0)!));
    if (!covered.length) continue;
    fonts.push({ ...fallback, font: await pdf.embedFont(fallback.bytes, { subset: false }) });
    missing = missing.filter((ch) => !covered.includes(ch));
  }

  // pick the first font that has a glyph for each character
  const fontIndex = new Map<string, number>();
  for (const ch of chars) {
    const i = fonts.findIndex((_, j) => has(j, ch));
    fontIndex.set(ch, i === -1 ? 0 : i);
  }
  // split a line into runs that share a font; spaces stay with the preceding run
  const runs = (line: string) => {
    const out: { text: string; font: (typeof fonts)[number]["font"] }[] = [];
    let current = -1;
    for (const ch of Array.from(line)) {
      const i = ch === " " && current !== -1 ? current : fontIndex.get(ch) ?? 0;
      if (i === current) out[out.length - 1].text += ch;
      else out.push({ text: ch, font: fonts[i].font }), (current = i);
    }
    return out;
  };

  const size = 11;
  const lineHeight = size * 1.4;
  const margin = 50;
  const [pageW, pageH] = [595.28, 841.89]; // A4
  const maxWidth = pageW - margin * 2;
  const widthOf = (line: string) =>
    runs(line).reduce((w, r) => w + r.font.widthOfTextAtSize(r.text, size), 0);

  // wrap every paragraph to the page width
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n")) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(/ +/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (widthOf(candidate) <= maxWidth) { line = candidate; continue; }
      if (line) lines.push(line);
      // a word longer than the line (or unspaced CJK text) is split by characters
      line = "";
      for (const ch of Array.from(word)) {
        if (line && widthOf(line + ch) > maxWidth) { lines.push(line); line = ""; }
        line += ch;
      }
    }
    lines.push(line);
  }

  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;
  for (const line of lines) {
    if (y < margin + lineHeight) {
      page = pdf.addPage([pageW, pageH]);
      y = pageH - margin;
    }
    y -= lineHeight;
    let x = margin;
    for (const run of runs(line)) {
      page.drawText(run.text, { x, y, size, font: run.font });
      x += run.font.widthOfTextAtSize(run.text, size);
    }
  }
  return pdf.save();
}

async function textToDocx(text: string): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const doc = new Document({
    sections: [{
      children: text.replace(/\r\n?/g, "\n").split("\n").map(
        (p) => new Paragraph({ children: [new TextRun(p)], spacing: { after: 120 } }),
      ),
    }],
  });
  // toBlob works in the browser; toBuffer needs Node's Buffer
  return Packer.toBlob(doc);
}

export default async function convertDocument(
  file: File,
  toFormat: string,
): Promise<{ url: string; output: string }> {
  const from = getExtension(file.name);
  const to = toFormat.toLowerCase();
  const data = await file.arrayBuffer();

  let text: string;
  if (from === "pdf") text = await extractPdfText(data);
  else if (from === "docx") text = await extractDocxText(data);
  else if (from === "txt") text = new TextDecoder().decode(data);
  else throw new Error(`Unsupported document type: .${from}`);

  let blob: Blob;
  if (to === "txt") blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  else if (to === "pdf") blob = new Blob([await textToPdf(text)], { type: "application/pdf" });
  else if (to === "docx") blob = await textToDocx(text);
  else throw new Error(`Unsupported target format: .${to}`);

  return { url: URL.createObjectURL(blob), output: `${removeExtension(file.name)}.${to}` };
}
