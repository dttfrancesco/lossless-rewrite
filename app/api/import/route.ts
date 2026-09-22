import { readPdf } from "@/lib/ui/read-pdf";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 10_000_000) return Response.json({ error: "Choose a PDF smaller than 10 MB." }, { status: 413 });
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "No PDF received." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 10_000_000) { await reader.cancel(); return Response.json({ error: "Choose a PDF smaller than 10 MB." }, { status: 413 }); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") return Response.json({ error: "This file is not a PDF." }, { status: 400 });
    return Response.json({ text: await readPdf(bytes) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not read the PDF." }, { status: 400 });
  }
}
