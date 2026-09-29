export const CHAR_DEFAULT={bf:[989.5,885,300],dad:[335.5,885,200],gf:[751.5,787,100]};
export const newChar=id=>{const[d,e,z]=CHAR_DEFAULT[id]||[0,0,0];return{zIndex:z,position:[d,e],cameraOffsets:[0,0]};};
export const DEFAULT_STAGE=()=>({version:'1.0.1',name:'My Custom Stage',cameraZoom:1,props:[],characters:{bf:newChar('bf'),dad:newChar('dad'),gf:newChar('gf')}});
export const slug=s=>String(s||'stage').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'stage';
const isPair=a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite);
// Fills only MISSING top-level fields; never removes or rewrites unknown fields.
export function normalize(s){if(!s||typeof s!=='object'||Array.isArray(s))return s;const d=DEFAULT_STAGE();
 for(const k of['version','name','cameraZoom'])if(!(k in s))s[k]=d[k];
 if(!('props'in s))s.props=[];if(!('characters'in s))s.characters={};return s;}
export function validate(s){if(!s||typeof s!=='object'||Array.isArray(s))return['Root must be a JSON object'];const e=[];
 if(typeof s.name!=='string')e.push('"name" must be a string');
 if(typeof s.cameraZoom!=='number')e.push('"cameraZoom" must be a number');
 if(!Array.isArray(s.props))e.push('"props" must be an array');
 else s.props.forEach((p,i)=>{if(!p||typeof p!=='object'){e.push(`props[${i}] must be an object`);return;}
  if(typeof p.assetPath!=='string')e.push(`props[${i}].assetPath must be a string`);
  if(p.position!==undefined&&!isPair(p.position))e.push(`props[${i}].position must be [x, y]`);});
 if(!s.characters||typeof s.characters!=='object'||Array.isArray(s.characters))e.push('"characters" must be an object');
 else for(const[k,c]of Object.entries(s.characters)){if(!c||typeof c!=='object'){e.push(`characters.${k} must be an object`);continue;}
  if(c.position!==undefined&&!isPair(c.position))e.push(`characters.${k}.position must be [x, y]`);}
 return e;}

// ---- ZIP reader (stored + deflate via native DecompressionStream) ----
const u16=(d,o)=>d.getUint16(o,true),u32=(d,o)=>d.getUint32(o,true);
export const isZip=b=>b.length>3&&b[0]===0x50&&b[1]===0x4b&&(b[2]===3||b[2]===5);
async function readZip(buf){const b=new Uint8Array(buf),d=new DataView(buf);let e=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(u32(d,i)===0x06054b50){e=i;break;}
 if(e<0)throw new Error('Corrupt ZIP: end of central directory not found');
 const n=u16(d,e+10);let p=u32(d,e+16);const out=[];
 for(let i=0;i<n;i++){if(p+46>b.length||u32(d,p)!==0x02014b50)throw new Error('Corrupt ZIP: bad central directory');
  const method=u16(d,p+10),cs=u32(d,p+20),nl=u16(d,p+28),el=u16(d,p+30),cl=u16(d,p+32),lo=u32(d,p+42);
  const path=new TextDecoder().decode(b.subarray(p+46,p+46+nl));p+=46+nl+el+cl;if(path.endsWith('/'))continue;
  if(u32(d,lo)!==0x04034b50)throw new Error('Corrupt ZIP: bad local header for '+path);
  const s=lo+30+u16(d,lo+26)+u16(d,lo+28);out.push({path,method,raw:b.subarray(s,s+cs)});}
 return out;}
async function inflate(en){if(en.method===0)return en.raw;
 if(en.method!==8)throw new Error('Unsupported ZIP compression method '+en.method);
 if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot decompress ZIP (no DecompressionStream)');
 try{return new Uint8Array(await new Response(new Blob([en.raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());}
 catch{throw new Error('Corrupt ZIP: cannot decompress '+en.path);}}

// Reads .fnfs/.zip/.json. Returns {stage,jsonPath,entries,images,extra}. Never modifies the source file.
export async function openContainer(buf){const b=new Uint8Array(buf);
 if(!isZip(b)){try{return{stage:JSON.parse(new TextDecoder().decode(b)),jsonPath:null,entries:[],images:[],extra:[]};}
  catch{throw new Error('Unrecognized file: not a ZIP container and not valid JSON. The file was not modified.');}}
 const ens=await readZip(buf),entries=[],images=[],extra=[],cands=[];
 for(const en of ens){const data=await inflate(en),kind=/\.(png|jpe?g|webp|svg)$/i.test(en.path)?'image':/\.json$/i.test(en.path)?'json':'other';
  entries.push({path:en.path,size:data.length,kind});
  if(kind==='image')images.push({path:en.path,data});
  else if(kind==='json'){let j=null;try{j=JSON.parse(new TextDecoder().decode(data));}catch{}
   if(j&&typeof j==='object'&&('props'in j||'characters'in j||'cameraZoom'in j))cands.push({path:en.path,j,data});else extra.push({path:en.path,data});}
  else extra.push({path:en.path,data});}
 const best=cands.find(c=>/stage/i.test(c.path))||cands[0];
 if(!best)throw new Error(`ZIP read OK (${ens.length} files) but no Stage JSON (props/characters/cameraZoom) was found.`);
 cands.filter(c=>c!==best).forEach(c=>extra.push({path:c.path,data:c.data}));
 return{stage:best.j,jsonPath:best.path,entries,images,extra};}

// ---- ZIP writer (stored) ----
const T=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
const crc=b=>{let c=-1;for(let i=0;i<b.length;i++)c=T[(c^b[i])&255]^(c>>>8);return(~c)>>>0;};
export function writeZip(files){const enc=new TextEncoder(),parts=[],cd=[];let off=0,cs=0;
 for(const f of files){const nm=enc.encode(f.path),c=crc(f.data),n=f.data.length,h=new DataView(new ArrayBuffer(30));
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint32(14,c,true);h.setUint32(18,n,true);h.setUint32(22,n,true);h.setUint16(26,nm.length,true);
  parts.push(new Uint8Array(h.buffer),nm,f.data);
  const q=new DataView(new ArrayBuffer(46));q.setUint32(0,0x02014b50,true);q.setUint16(4,20,true);q.setUint16(6,20,true);q.setUint16(8,0x800,true);
  q.setUint32(16,c,true);q.setUint32(20,n,true);q.setUint32(24,n,true);q.setUint16(28,nm.length,true);q.setUint32(42,off,true);
  cd.push(new Uint8Array(q.buffer),nm);off+=30+nm.length+n;cs+=46+nm.length;}
 const e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
 return new Blob([...parts,...cd,new Uint8Array(e.buffer)],{type:'application/zip'});}

export async function buildPackage(stage,assets,c){const files=[];
 files.push({path:(c&&c.jsonPath)||`data/stages/${slug(stage.name)}.json`,data:new TextEncoder().encode(JSON.stringify(stage,null,2))});
 for(const a of assets)files.push({path:a.path,data:new Uint8Array(await a.blob.arrayBuffer())});
 for(const x of(c&&c.extra)||[])files.push(x);
 return writeZip(files);}
