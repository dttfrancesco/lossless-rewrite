import {readFile,readdir,stat,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const storeBuild=process.argv.includes('--store');
const root=resolve(import.meta.dirname,'..'),dir=resolve(root,storeBuild?'extension/store-dist':'extension/dist');
async function files(path){const result=[];for(const entry of await readdir(path,{withFileTypes:true})){const full=resolve(path,entry.name);if(entry.isSymbolicLink())throw Error('Symlink in release');if(entry.isDirectory())result.push(...await files(full));else result.push(full);}return result;}
const paths=await files(dir),manifest=JSON.parse(await readFile(resolve(dir,'manifest.json'),'utf8'));
const required=['manifest.json','background.js','content.js','panel.js','panel.html','account.js','account.html','plans.js','plans.html','reference.js','reference.html','README.html','LICENSE','PDFJS-LICENSE','pdf.worker.mjs','icons/icon-128.png'];
const names=paths.map(p=>relative(dir,p).replaceAll('\\','/'));
for(const file of required)if(!names.includes(file))throw Error(`Missing release file: ${file}`);
for(const name of names)if(/(?:^|\/)(?:\.env|private|node_modules)|\.(?:map|test\.mjs|ts|zip)$/i.test(name)||/fixture|smoke|secret|service.role/i.test(name))throw Error(`Unexpected release file: ${name}`);
if(manifest.manifest_version!==3||manifest.host_permissions.includes('<all_urls>'))throw Error('Unexpected permission scope');
const secretPatterns=[/xkeysib-[A-Za-z0-9-]{30,}/,/sk_live_[A-Za-z0-9]{15,}/,/sb_secret_[A-Za-z0-9_-]{15,}/,/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/];
for(const path of paths.filter(p=>/\.(?:js|mjs|html|json)$/.test(p))){const text=await readFile(path,'utf8');if(secretPatterns.some(p=>p.test(text)))throw Error(`Credential pattern in ${relative(dir,path)}`);if(/<script[^>]+src=["']https?:/i.test(text))throw Error('Remote script in release');}
const records=[];for(const path of paths){const bytes=await readFile(path);records.push({file:relative(dir,path).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const report={version:manifest.version,manifestVersion:manifest.manifest_version,files:records.length,bytes:records.reduce((s,r)=>s+r.bytes,0),permissions:manifest.permissions,optionalPermissions:manifest.optional_permissions,hostPermissions:manifest.host_permissions,filesHash:records,notes:['Package audit only; not installed-platform or Chrome Web Store approval.','Store OAuth callback must be registered and tested after a draft upload assigns the store ID.']};
const out=resolve(root,'private/extension-release');await mkdir(out,{recursive:true});await writeFile(resolve(out,`package-audit-${manifest.version}.json`),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({version:report.version,files:report.files,bytes:report.bytes,credentialPatternsFound:0,remoteScriptTagsFound:0}));
