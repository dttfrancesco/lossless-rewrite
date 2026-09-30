import { build } from "esbuild";
import { mkdir, copyFile, readFile, writeFile, cp } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, "..");
const storeBuild=process.argv.includes('--store');
const outdir = resolve(root, storeBuild?"extension/store-dist":"extension/dist");
await mkdir(outdir, { recursive: true });
await build({ absWorkingDir: root, entryPoints: ["extension/background.js", "extension/panel.js", "extension/reference.js", "extension/account.js", "extension/plans.js"], bundle: true, format: "esm", platform: "browser", target: "chrome116", outdir, sourcemap: false });
await build({ absWorkingDir: root, entryPoints: ["extension/content.js"], bundle: true, format: "iife", platform: "browser", target: "chrome116", outdir, sourcemap: false });
for (const file of ["manifest.json", "panel.html", "panel.css", "plans.html", "plans.css", "account.html", "README.html", "reference.html", "reference.css"]) await copyFile(resolve(root, "extension", file), resolve(outdir, file));
for (const [source, target] of [["legacy/build/pdf.worker.mjs", "pdf.worker.mjs"], ["web/pdf_viewer.css", "pdf_viewer.css"], ["LICENSE", "PDFJS-LICENSE"]]) await copyFile(resolve(root, "node_modules/pdfjs-dist", source), resolve(outdir, target));
for (const directory of ["cmaps", "standard_fonts"]) await cp(resolve(root, "node_modules/pdfjs-dist", directory), resolve(outdir, directory), { recursive: true });
await mkdir(resolve(outdir, "icons"), { recursive: true });
await copyFile(resolve(root, "extension/icons/mark.svg"), resolve(outdir, "icons/mark.svg"));
for (const size of [16, 32, 48, 128]) await copyFile(resolve(root, `extension/icons/icon-${size}.png`), resolve(outdir, `icons/icon-${size}.png`));
await copyFile(resolve(root, "LICENSE"), resolve(outdir, "LICENSE"));
const manifest = JSON.parse(await readFile(resolve(outdir, "manifest.json"), "utf8"));
if(storeBuild){
  const identity=JSON.parse(await readFile(resolve(root,'extension/store-identity.json'),'utf8'));
  const id=createHash('sha256').update(Buffer.from(identity.key,'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,char=>String.fromCharCode(97+parseInt(char,16)));
  if(id!==identity.id)throw new Error('Store public key does not match the registered store ID.');
  manifest.key=identity.key;
}
await writeFile(resolve(outdir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built unpacked extension: ${outdir}`);
