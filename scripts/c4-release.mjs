/** Static release assembly only. No environment, credentials, activation or deployment. */
import{readFile,readdir,lstat,mkdir,writeFile}from'node:fs/promises';import{resolve,sep,dirname}from'node:path';import{createHash}from'node:crypto';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const staticName=name=>!name.split('/').some(p=>p.startsWith('.'))&&/\.(?:html|js|css|svg|png|ico|woff2?|webmanifest|txt)$/.test(name);
export function releasePath(root,name){
 if(typeof name!=='string'||!name||!/^[-a-zA-Z0-9_.\/]+$/.test(name)||name.split('/').some(x=>!x||x==='.'||x==='..')||name.startsWith('/'))throw Error('Invalid release path');
 const target=resolve(root,...name.split('/'));if(!target.startsWith(resolve(root)+sep))throw Error('Release path escaped');return target;
}
export async function readStaticTree(root){
 const result=new Map();
 const walk=async prefix=>{for(const entry of await readdir(prefix?releasePath(root,prefix):root)){const name=prefix?prefix+'/'+entry:entry,path=releasePath(root,name),stat=await lstat(path);if(stat.isSymbolicLink())throw Error('Release symlink refused');if(stat.isDirectory())await walk(name);else if(stat.isFile())result.set(name,await readFile(path));else throw Error('Unexpected release object');}};
 await walk('');return new Map([...result].sort(([a],[b])=>a.localeCompare(b)));
}
export async function verifyRelease(site,manifest){
 if(manifest.schema!==1||manifest.origin!=='https://wie116.github.io'||manifest.base!=='/tempo/'||manifest.pilot!=='/tempo/pilot/pilot.html'||!Array.isArray(manifest.files))throw Error('Unreviewed release target');
 const files=await readStaticTree(site);if(files.size!==manifest.files.length)throw Error('Unexpected release file count');
 for(const file of manifest.files){releasePath(site,file.path);if(!staticName(file.path))throw Error('Non-static release file refused');const bytes=files.get(file.path);if(!bytes||bytes.length!==file.bytes||sha256(bytes)!==file.sha256)throw Error('Release integrity mismatch: '+file.path);}
 if(new Set(manifest.files.map(x=>x.path)).size!==files.size)throw Error('Duplicate release file');
 for(const name of ['index.html','sw.js','pilot/pilot.html','pilot/pilot-sw.js','pilot/manifest.webmanifest'])if(!files.has(name))throw Error('Incomplete release');
 const pwa=JSON.parse(files.get('pilot/manifest.webmanifest').toString('utf8'));if(pwa.start_url!=='./pilot.html'||pwa.scope!=='./'||pwa.id!=='/tempo/pilot/pilot.html')throw Error('Pilot PWA escaped its path');
 if(!files.get('pilot/pilot.html').toString('utf8').includes('/tempo/pilot/assets/'))throw Error('Pilot assets escaped base');
 return{files:files.size,bytes:[...files.values()].reduce((n,b)=>n+b.length,0)};
}
export async function composeRelease({baseline,pilot,destination,legacyWorker,legacyDeploymentSha,sourceManifestSha256,sqlCandidateSha256}){
 for(const hash of [legacyDeploymentSha,sourceManifestSha256,sqlCandidateSha256])if(!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(hash))throw Error('Missing release provenance');
 const old=await readStaticTree(baseline),next=await readStaticTree(pilot);if(!old.has('index.html')||!old.has('sw.js')||[...old.keys()].some(p=>p.startsWith('pilot/')))throw Error('Invalid legacy baseline');
 if([...next.keys()].some(p=>p==='sw.js'||p.endsWith('.map')||p.startsWith('.')))throw Error('Unreviewed pilot output');
 await mkdir(destination);const merged=new Map(old);merged.set('sw.js',Buffer.from(legacyWorker));for(const[name,bytes]of next)merged.set('pilot/'+name,bytes);
 if([...merged.keys()].some(name=>!staticName(name)))throw Error('Non-static release file refused');
 for(const[name,bytes]of merged){const path=releasePath(destination,name);await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:'wx'});}
 const manifest={schema:1,scope:'review-only-preserved-live-legacy-plus-isolated-pilot',origin:'https://wie116.github.io',base:'/tempo/',pilot:'/tempo/pilot/pilot.html',legacyDeploymentSha,sourceManifestSha256,sqlCandidateSha256,
  legacyPreservedFiles:old.size-1,changedLegacyFiles:[{path:'sw.js',beforeSha256:sha256(old.get('sw.js')),afterSha256:sha256(legacyWorker)}],files:[...merged].sort(([a],[b])=>a.localeCompare(b)).map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha256(bytes)})),activationAuthorized:false};
 await verifyRelease(destination,manifest);return manifest;
}
