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
  // Unicode font, so diacritics (č, ř, ž…) work — standard PDF fonts only cover WinAnsi
  const fontBytes = await fetch("/fonts/DejaVuSans.ttf").then((r) => r.arrayBuffer());
  const font = await pdf.embedFont(fontBytes, { subset: true });

  const size = 11;
  const lineHeight = size * 1.4;
  const margin = 50;
  const [pageW, pageH] = [595.28, 841.89]; // A4
  const maxWidth = pageW - margin * 2;

  // wrap every paragraph to the page width
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n")) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(/ +/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue; }
      if (line) lines.push(line);
      // a single word longer than the line gets hard-split
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let n = rest.length;
        while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > maxWidth) n--;
        lines.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      line = rest;
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
    if (line) page.drawText(line, { x: margin, y, size, font });
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
