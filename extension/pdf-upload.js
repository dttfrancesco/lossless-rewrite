export function chosenPDF(files) {
  if(!files?.length)return null;
  if(files.length!==1)throw new Error('Open one PDF at a time.');
  const file=files[0];
  if(!/\.pdf$/i.test(file.name||'') && file.type!=='application/pdf')throw new Error('Choose a PDF file.');
  if(!file.size)throw new Error('This file is empty. Choose a PDF with content.');
  if(file.size>25*1024*1024)throw new Error('Choose a PDF under 25 MB.');
  return file;
}
export function installPDFDrop({zone,input,open,status,container=document}) {
  let depth=0;
  const isFile=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
  const clear=()=>{depth=0;zone.classList.remove('drag-over');};
  async function accept(files){try{const file=chosenPDF(files);if(file)await open(file);}catch(e){status(e.message);}finally{input.value='';clear();}}
  input.onchange=()=>accept(input.files);
  container.addEventListener('dragenter',e=>{if(!isFile(e))return;e.preventDefault();depth++;zone.classList.add('drag-over');});
  container.addEventListener('dragover',e=>{if(isFile(e)){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
  container.addEventListener('dragleave',e=>{if(isFile(e)&&--depth<=0)clear();});
  container.addEventListener('drop',e=>{if(!isFile(e))return;e.preventDefault();clear();accept(e.dataTransfer.files);});
}
