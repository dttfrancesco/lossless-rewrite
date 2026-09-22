import test from "node:test";
import assert from "node:assert/strict";
import { readPdf } from "./read-pdf";

export function pdfFixture(text = "A complete source document."): Uint8Array {
  const stream = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let doc = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(doc)); doc += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const at = Buffer.byteLength(doc);
  doc += `xref\n0 6\n0000000000 65535 f \n${offsets.map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${at}\n%%EOF`;
  return new Uint8Array(Buffer.from(doc));
}

test("PDF import extracts selectable text and rejects empty or invalid documents", async () => {
  assert.equal(await readPdf(pdfFixture()), "A complete source document.");
  await assert.rejects(readPdf(pdfFixture("")), /no selectable text/);
  await assert.rejects(readPdf(new Uint8Array(Buffer.from("not a PDF"))));
});
