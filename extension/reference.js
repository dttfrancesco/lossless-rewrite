import { shortcutLabels } from './shortcuts.js';
import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist/legacy/build/pdf.mjs';
GlobalWorkerOptions.workerPort = new Worker(chrome.runtime.getURL('pdf.worker.mjs'), { type: 'module' });
const $ = id => document.getElementById(id), token = new URLSearchParams(location.search).get('token');
let pdf, loading, fileName = '', pageNumber = 1, context, selected = '', rendering = false;
const status = text => { $('status').textContent = text; };
async function request(action, args = {}) {
  const result = await chrome.runtime.sendMessage({ kind: 'protections', token, action, ...args });
  if (result?.error) throw new Error(result.error);
  if (!result?.context) throw new Error('Open this reader using Open PDF beside your chat.');
  context = result.context; $('linked').textContent = `Linked to ${new URL(context.scope).hostname}. ${context.items.length} passages kept.`;
  $('kept').replaceChildren(...context.items.filter(i => i.source.kind === 'pdf').map(i => { const p = document.createElement('p'); p.textContent = `${i.source.label}, p. ${i.source.page}: ${i.text}`; return p; }));
}
function clearSelection() { selected = ''; $('selected').value = ''; $('meaning').disabled = $('wording').disabled = true; }
async function renderPage() {
  if (!pdf || rendering) return;
  rendering = true; $('prev').disabled = $('next').disabled = true; clearSelection();
  try {
    const page = await pdf.getPage(pageNumber), base = page.getViewport({ scale: 1 });
    const scale = Math.min(1.4, Math.max(0.5, (innerWidth - (innerWidth > 760 ? 410 : 45)) / base.width), Math.sqrt(10000000 / (base.width * base.height)));
    const viewport = page.getViewport({ scale }), canvas = document.querySelector('canvas'), layer = document.querySelector('.textLayer');
    canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
    $('page').style.width = `${viewport.width}px`; $('page').style.height = `${viewport.height}px`; $('page').style.setProperty('--total-scale-factor', scale);
    layer.replaceChildren();
    await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
    const content = await page.getTextContent();
    await new TextLayer({ textContentSource: content, container: layer, viewport }).render();
    $('page-number').textContent = `${pageNumber} / ${pdf.numPages}`;
    status(content.items.some(i => i.str?.trim()) ? 'Select a passage on the page.' : 'This page has no selectable text. Scanned pages need OCR first.');
  } catch (e) { status(`Cannot render this page: ${e.message}`); }
  finally { rendering = false; $('prev').disabled = pageNumber <= 1; $('next').disabled = pageNumber >= pdf.numPages; }
}
$('file').onchange = async () => {
  const file = $('file').files[0]; if (!file) return;
  if (file.size > 25 * 1024 * 1024) { status('Choose a PDF under 25 MB.'); return; }
  if (rendering) { status('Wait for this page to finish rendering.'); return; }
  $('file').disabled = true;
  try {
    await request('get'); status('Opening PDF on this device…'); await loading?.destroy(); pdf = undefined;
    loading = getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, useWasm: false, enableXfa: false, standardFontDataUrl: chrome.runtime.getURL('standard_fonts/'), cMapUrl: chrome.runtime.getURL('cmaps/'), cMapPacked: true });
    // Do not leave password-protected PDFs waiting indefinitely for an unset callback.
    loading.onPassword = () => { status('Open an unencrypted copy of this PDF.'); loading.destroy(); };
    pdf = await loading.promise; fileName = file.name.slice(0, 300); pageNumber = 1; await renderPage();
  } catch (e) { status(`Cannot open this PDF: ${e.message}`); }
  finally { $('file').disabled = false; }
};
$('prev').onclick = () => { if (!rendering && pageNumber > 1) { pageNumber--; renderPage(); } };
$('next').onclick = () => { if (!rendering && pageNumber < pdf.numPages) { pageNumber++; renderPage(); } };
function selectionChanged() {
  const s = getSelection(), layer = document.querySelector('.textLayer');
  if (!s?.rangeCount || !layer.contains(s.anchorNode) || !layer.contains(s.focusNode)) return;
  selected = s.toString(); $('selected').value = selected;
  $('meaning').disabled = $('wording').disabled = !selected.trim() || selected.length > 12000;
}
document.addEventListener('mouseup', selectionChanged); document.addEventListener('keyup', selectionChanged);
for (const [id, type] of [['meaning', 'keep_meaning'], ['wording', 'keep_wording']]) $(id).onclick = async () => {
  try { await request('add', { scope: context.scope, item: { type, text: selected, source: { kind: 'pdf', label: fileName, page: pageNumber } } }); status(`Saved to the linked chat. Write your request there and press ${shortcutLabels().send}.`); clearSelection(); }
  catch (e) { status(e.message); }
};
$('back').onclick = () => request('back').catch(e => status(e.message));
request('get').catch(e => { status(e.message); $('file').disabled = true; });
