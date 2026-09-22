import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function readPdf(data: Uint8Array): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // A real filesystem URL is required; bundler module IDs cannot start PDF.js's Node worker.
  const packageRoot = resolve(process.cwd(), "node_modules/pdfjs-dist");
  GlobalWorkerOptions.workerSrc = pathToFileURL(resolve(packageRoot, "legacy/build/pdf.worker.mjs")).href;
  const task = getDocument({ data, useSystemFonts: false, standardFontDataUrl: resolve(packageRoot, "standard_fonts").replaceAll("\\", "/") + "/" });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 200) throw new Error("Choose a PDF with 200 pages or fewer.");
    const pages: string[] = [];
    let length = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
      length += text.length;
      if (length > 500_000) throw new Error("PDF text exceeds the source size limit.");
      pages.push(text);
    }
    const text = pages.join("\n\n");
    if (!text.trim()) throw new Error("This PDF has no selectable text. Paste text from an OCR tool instead.");
    return text;
  } finally { await task.destroy(); }
}
