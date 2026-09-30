import {session,cloudCall} from './cloud.js';
import {fileId,saveProject,listProjects,projectFile,deleteProject} from './projects.js';
import { shortcutLabels } from './shortcuts.js';
import { installPDFDrop } from './pdf-upload.js';
import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist/legacy/build/pdf.mjs';
GlobalWorkerOptions.workerPort = new Worker(chrome.runtime.getURL('pdf.worker.mjs'), { type: 'module' });
const $ = id => document.getElementById(id), token = new URLSearchParams(location.search).get('token');
let activeFileId, projectId;const openedFiles=new Map();
let pdf, loading, fileName = '', pageNumber = 1, context, selected = '', rendering = false, opening = false, zoom = 1, rerender = false;
const documentView = document.querySelector('.document');
const status = text => { $('status').textContent = text; };
async function request(action, args = {}) {
  const result = await chrome.runtime.sendMessage({ kind: 'protections', token, action, ...args });
  if (result?.error) throw new Error(result.error);
  if (!result?.context) throw new Error('Open this reader using Open PDF beside your chat.');
  context = result.context; $('linked').textContent = `Linked to ${new URL(context.scope).hostname}. ${context.items.length} passages kept.`;
  $('kept-summary').textContent = `Selected passages (${context.items.filter(i=>i.source.kind==='pdf').length})`;
  $('kept').replaceChildren(...context.items.filter(i => i.source.kind === 'pdf').map(i => { const p = document.createElement(i.source.fileId?'button':'p'); if(i.source.fileId){p.dataset.fileId=i.source.fileId;p.dataset.page=i.source.page;p.title='Open source page';} p.textContent = `${i.source.label}, p. ${i.source.page}: ${i.text}`; return p; }));
}
function clearSelection() { selected = ''; $('selected').value = ''; $('meaning').disabled = $('wording').disabled = true; $('selection-tools').hidden=true; }
async function renderPage() {
  if (!pdf) return;
  if (rendering) { rerender=true; return; }
  rendering = true; $('prev').disabled = $('next').disabled = true; clearSelection();
  try {
    const page = await pdf.getPage(pageNumber), base = page.getViewport({ scale: 1 });
    const scale = Math.min(Math.max(.1,(documentView.clientWidth-18)/base.width)*zoom, Math.sqrt(5000000/(base.width*base.height)));
    const viewport = page.getViewport({ scale }), canvas = document.querySelector('canvas'), layer = document.querySelector('.textLayer');
    const ratio=Math.min(devicePixelRatio||1,2);
    canvas.width = Math.floor(viewport.width*ratio); canvas.height = Math.floor(viewport.height*ratio);
    canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
    $('page').style.width = `${viewport.width}px`; $('page').style.height = `${viewport.height}px`; $('page').style.setProperty('--total-scale-factor', scale);
    layer.replaceChildren();
    await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0] }).promise;
    const content = await page.getTextContent();
    await new TextLayer({ textContentSource: content, container: layer, viewport }).render();
    $('page-number').textContent = `${pageNumber} / ${pdf.numPages}`;
    status(content.items.some(i => i.str?.trim()) ? 'Select a passage on the page.' : 'This page has no selectable text. Scanned pages need OCR first.');
  } catch (e) { status(`Cannot render this page: ${e.message}`); }
  finally { rendering = false; $('prev').disabled = pageNumber <= 1; $('next').disabled = pageNumber >= pdf.numPages; if(rerender){rerender=false;renderPage();} }
}
async function displayFile(file,page=1) {
  if(opening||rendering)throw new Error('Wait for the PDF to finish opening.');
  opening=true;$('file').disabled=true;
  try {
    await request('get'); status('Opening PDF on this device…'); await loading?.destroy(); pdf = undefined;
    documentView.hidden=$('page-nav').hidden=true;clearSelection();
    const bytes=file.bytes instanceof ArrayBuffer?file.bytes.slice(0):await file.arrayBuffer(),id=file.id||await fileId(bytes),saved={id,name:file.name,bytes:bytes.slice(0)};
    loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useWasm: false, enableXfa: false, standardFontDataUrl: chrome.runtime.getURL('standard_fonts/'), cMapUrl: chrome.runtime.getURL('cmaps/'), cMapPacked: true });
    // Do not leave password-protected PDFs waiting indefinitely for an unset callback.
    loading.onPassword = () => { status('Open an unencrypted copy of this PDF.'); loading.destroy(); };
    pdf = await loading.promise; fileName = file.name.slice(0, 300);activeFileId=id;openedFiles.set(id,saved);pageNumber=Math.max(1,Math.min(page,pdf.numPages));zoom=1;
    document.body.classList.add('loaded');$('file-label').textContent=fileName;documentView.hidden=$('page-nav').hidden=false;await renderPage();
  } catch (e) { document.body.classList.remove('loaded');$('file-label').textContent='Drop a PDF here';throw new Error(`Cannot open this PDF: ${e.message}`); }
  finally { opening=false;$('file').disabled = false; }
}
installPDFDrop({zone:$('drop-zone'),input:$('file'),open:displayFile,status});
$('zoom-in').onclick=()=>{zoom=Math.min(3,zoom+.25);renderPage();};
$('zoom-out').onclick=()=>{zoom=Math.max(.5,zoom-.25);renderPage();};
$('fit').onclick=()=>{zoom=1;renderPage();};
let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>renderPage(),150);});
$('prev').onclick = () => { if (!rendering && pageNumber > 1) { pageNumber--; renderPage(); } };
$('next').onclick = () => { if (!rendering && pageNumber < pdf.numPages) { pageNumber++; renderPage(); } };
function selectionChanged() {
  const s = getSelection(), layer = document.querySelector('.textLayer');
  if (!s?.rangeCount || !layer.contains(s.anchorNode) || !layer.contains(s.focusNode)) return;
  selected = s.toString(); $('selected').value = selected;
  $('selection-tools').hidden=!selected.trim();
  $('meaning').disabled = $('wording').disabled = !selected.trim() || selected.length > 12000;
}
document.addEventListener('mouseup', selectionChanged); document.addEventListener('keyup', selectionChanged);
for (const [id, type] of [['meaning', 'keep_meaning'], ['wording', 'keep_wording']]) $(id).onclick = async () => {
  try { await request('add', { scope: context.scope, item: { type, text: selected, source: { kind: 'pdf', label: fileName, page: pageNumber, fileId:activeFileId } } }); status(`Saved to the linked chat. Write your request there and press ${shortcutLabels().send}.`); clearSelection(); }
  catch (e) { status(e.message); }
};
$('back').onclick = () => request('back').catch(e => status(e.message));
request('get').catch(e => { status(e.message); $('file').disabled = true; });
document.querySelector('[data-send-keys]').textContent=shortcutLabels().send;
// Keep the floating controls hidden while the PDF occupies the side panel.
if(chrome.runtime.connect&&chrome.windows){const port=chrome.runtime.connect({name:'lossless-panel'});chrome.windows.getCurrent().then(window=>{const presence=()=>{try{port.postMessage({kind:'panel-presence',windowId:window.id,visible:document.visibilityState==='visible'});}catch{}};presence();document.addEventListener('visibilitychange',presence);}).catch(()=>{});}

async function projectOwner(write=false){const current=await session();if(!current)throw new Error('Sign in through Account in the sidebar to use Pro projects.');const account=write?await cloudCall({action:'account'}):null;if(write&&account.plan!=='pro')throw new Error('Saved reference projects require Pro. The current PDF reader remains free.');return current.user.id;}
function fileLinks(files,open){$('project-files').replaceChildren();for(const file of files){const button=document.createElement('button');button.textContent=file.name;button.onclick=()=>open(file).catch(e=>status(e.message));$('project-files').append(button);}}
async function openSaved(file,page=1){await displayFile(file,page);}
$('save-project').onclick=async()=>{try{const owner=await projectOwner(true);await request('get');projectId=await saveProject({owner,id:projectId,name:$('project-name').value,items:context.items,files:[...openedFiles.values()]});status('Project saved on this device. PDFs were not uploaded.');}catch(e){status(e.message);}};
$('list-projects').onclick=async()=>{try{const owner=await projectOwner(),projects=await listProjects(owner);$('project-list').replaceChildren();for(const project of projects){const row=document.createElement('div'),open=document.createElement('button'),remove=document.createElement('button');open.textContent=project.name;remove.textContent='Delete';open.onclick=async()=>{try{await projectOwner();const loaded=await Promise.all(project.files.map(f=>projectFile(owner,project.id,f)));await request('import',{items:project.items});openedFiles.clear();for(const f of loaded)openedFiles.set(f.id,f);projectId=project.id;$('project-name').value=project.name;fileLinks(loaded,openSaved);if(loaded[0])await openSaved(loaded[0]);status('Project opened. Its marked passages were added to this chat.');}catch(e){status(e.message);}};remove.onclick=async()=>{if(confirm('Delete this saved project and its PDFs from this device?')){await deleteProject(owner,project.id);row.remove();}};row.append(open,remove);$('project-list').append(row);}if(!projects.length)status('No saved projects yet.');}catch(e){status(e.message);}};
// Clicking a saved PDF passage returns to its exact source page.
$('kept').addEventListener('click',e=>{const target=e.target.closest('[data-file-id]');if(!target)return;const file=openedFiles.get(target.dataset.fileId);if(file)openSaved(file,Number(target.dataset.page)).catch(e=>status(e.message));});
