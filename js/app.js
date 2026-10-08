import{DEFAULT_STAGE,newChar,normalize,validate,openContainer,buildPackage,slug}from'./stage.js';
import{parseAtlas,atlasPrefixes,animFrames,atlasKind}from'./atlas.js';
import{ic,hydrate}from'./icons.js';
import{isAstc,decodeAstc}from'./astc.js';
hydrate();
const $=s=>document.querySelector(s);
const el=(t,a={},...k)=>{const e=document.createElement(t);for(const[x,y]of Object.entries(a))(x in e)?e[x]=y:e.setAttribute(x,y);e.append(...k);return e;};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const mime=p=>({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'})[String(p).split('.').pop().toLowerCase()]||'application/octet-stream';
let stage=DEFAULT_STAGE(),container=null,sel=null,curAsset=null,isDirty=false,rev=0,autoT=0,mvT=0,tt=0,VW=0,VH=0,dpr=1,pend=0,ac=null,bump=0,raf=0,pv=0;
const view={x:640,y:400,z:.5};let V=view;
const assets=[],flags={hid:new Set(),lock:new Set()},cfg={snap:10,grid:true,cam:true,camX:640,camY:360,mode:false,anim:true};
const charVis={};/* editor-only character visuals (never written to the stage JSON) */
const PK='fnfse.prefs',prefs={autosave:60};
try{const q=JSON.parse(localStorage.getItem(PK)||'{}');if(q&&(q.autosave===0||(q.autosave>=5&&q.autosave<=3600)))prefs.autosave=+q.autosave;}catch{}
const setPref=(k,v)=>{prefs[k]=v;try{localStorage.setItem(PK,JSON.stringify(prefs));}catch{}};
const prevAnim=new Map(),animStart=new Map(),danceIdx=new Map();let animT0=performance.now(),animRaf=0,animLast=0,playT0=0;
const Hs={u:[],r:[],last:JSON.stringify(stage)};
const cv=$('#cv'),cx=cv.getContext('2d'),vp=$('#vp'),js=$('#js');

/* ---------- UI helpers ---------- */
function toast(m,err){const t=$('#toast');t.textContent=m;t.className=err?'err show':'show';clearTimeout(tt);tt=setTimeout(()=>t.className='',4500);}
function modal(title,...k){$('#dt').textContent=title;$('#db').replaceChildren(...k);const d=$('#dlg');if(!d.open)d.showModal();}
const on=(id,f)=>$('#'+id).addEventListener('click',f);
function dl(blob,name){const u=URL.createObjectURL(blob),a=el('a',{href:u,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000);}
addEventListener('unhandledrejection',e=>toast('Unexpected error: '+((e.reason&&e.reason.message)||e.reason),1));

/* ---------- Stage model ---------- */
const sc=o=>Array.isArray(o.scale)?o.scale.slice():[o.scale??1,o.scale??1];
const sn=v=>cfg.snap>0?+(Math.round(v/cfg.snap)*cfg.snap).toFixed(3):v;
const objs=()=>[...stage.props.map((o,i)=>({k:'p',i,o,key:'p:'+(o.name??i)})),...Object.entries(stage.characters).map(([id,o])=>({k:'c',id,o,key:'c:'+id}))].sort((a,b)=>(+a.o.zIndex||0)-(+b.o.zIndex||0));
const same=it=>!!sel&&sel.k===it.k&&(it.k==='p'?sel.i===it.i:sel.id===it.id);
const cur=()=>sel?objs().find(same)||null:null;
const selObj=()=>{const c=cur();return c&&c.o;};
const pick=it=>{sel=it.k==='p'?{k:'p',i:it.i}:{k:'c',id:it.id};renderList();renderInsp();draw();};
/* ---------- Character visuals (editor-only preview of BF / DAD / GF) ---------- */
const isPair=a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite);
const pairOf=a=>isPair(a)?a:[0,0];
const baseName=p=>String(p||'').split('/').pop();
function charDataError(j){if(!j||typeof j!=='object'||Array.isArray(j))return'not a character JSON object';
 if('props'in j||'cameraZoom'in j||'characters'in j)return'this looks like a stage JSON, not a character';
 if(typeof j.assetPath!=='string'||!j.assetPath)return'missing \"assetPath\"';
 if(j.animations!==undefined&&!Array.isArray(j.animations))return'\"animations\" must be an array';
 if(j.offsets!==undefined&&!isPair(j.offsets))return'\"offsets\" must be [x, y]';
 if(j.scale!==undefined&&!Number.isFinite(j.scale))return'\"scale\" must be a number';return'';}
function charInfo(id){const v=charVis[id];if(!v||!v.data)return null;
 const a=(v.assetKey&&assets.find(x=>x.path===v.assetKey))||findAsset(v.data.assetPath);return{v,d:v.data,a};}
// Virtual "prop" so the same atlas/animation code can draw a character.
function charProp(id){const v=charVis[id],so=stage.characters[id];if(!v||!so)return null;const d=v.data,k=+d.scale>0?+d.scale:1,[sx,sy]=sc(so);
 return{name:'char:'+id,assetPath:d.assetPath,animations:d.animations,startingAnimation:d.startingAnimation,scale:[k*sx,k*sy],isPixel:!!d.isPixel,danceEvery:d.danceEvery};}
const needsAtlas=d=>/^(sparrow|packer|multisparrow)$/i.test(d.renderType||'');
// Same placement as the game: sprite feet (bottom-centre) sit on stage position, then the character's own offsets apply.
function charBox(it){const ci=charInfo(it.id);if(!ci||!ci.a||!ci.a.img||(needsAtlas(ci.d)&&!ci.a.atlas))return null;
 const vp=charProp(it.id),a=ci.a,f=a.atlas?firstFrame(vp,a):null,[kx,ky]=vp.scale,w=(f?f.fw:a.w)*kx,h=(f?f.fh:a.h)*ky,[x,y]=it.o.position||[0,0],[ox,oy]=ci.v.useOffsets?pairOf(ci.d.offsets):[0,0];
 return{x:x-w/2+ox,y:y-h+oy,w,h,a,vp,flip:!!ci.v.flipX};}
function charNote(id){const ci=charInfo(id);if(!ci)return'';const b=baseName(ci.d.assetPath);
 if(!ci.a)return` · sprite missing: ${b}`;if(!ci.a.img)return' · sprite cannot be decoded here';if(needsAtlas(ci.d)&&!ci.a.atlas)return` · needs ${b}.xml / .txt`;return'';}
function useAssetVisual(id,a){const an=a.atlas?detectAnims(a):[];
 charVis[id]={src:'asset',assetKey:a.path,flipX:false,data:{name:a.base,renderType:a.atlas?a.atlas.type:'static',assetPath:a.path.replace(/^images\//,'').replace(/\.\w+$/,''),scale:1,offsets:[0,0],isPixel:false,flipX:false,danceEvery:0,
  ...(an.length?{startingAnimation:an[0].name,animations:an}:{})}};prevAnim.delete('char:'+id);}
function visChanged(){renderAssets();renderInsp();draw();dirty();}
function findAsset(p){const l=String(p||'').toLowerCase(),b=l.split('/').pop();
 return assets.find(a=>a.path.toLowerCase().replace(/^images\//,'').replace(/\.\w+$/,'')===l)||assets.find(a=>a.base.toLowerCase()===b);}
/* ---------- Atlas animation helpers ---------- */
const alphaOf=o=>o.alpha===undefined||o.alpha===null||!Number.isFinite(+o.alpha)?1:clamp(+o.alpha,0,1);
function curAnim(o){const l=Array.isArray(o.animations)?o.animations.filter(x=>x&&typeof x==='object'):[];if(!l.length)return null;
 const nm=prevAnim.get(o.name)??o.startingAnimation;return l.find(x=>x.name===nm)||l[0];}
function firstFrame(o,a){const an=curAnim(o),l=an?animFrames(a.atlas,an):[];return l[0]||a.atlas.frames[0];}
function animFrame(o,a,key,now){const an=curAnim(o),l=an?animFrames(a.atlas,an):[];if(!an||!l.length)return{fr:a.atlas.frames[0],an:null};
 const fps=Math.max(1,+an.frameRate||24),t=(now-(animStart.get(key)??animT0))/1000,i=Math.floor(t*fps),n=l.length;
 return{fr:l[an.looped===false?Math.min(i,n-1):i%n],an};}
function animTargets(){const l=[];stage.props.forEach((o,i)=>{if(o)l.push({key:'p:'+(o.name??i),o,a:findAsset(o.assetPath)});});
 for(const id of Object.keys(charVis)){const ci=charInfo(id),vp=charProp(id);if(ci&&vp&&ci.a)l.push({key:'c:'+id,o:vp,a:ci.a});}return l;}
const hasAnim=()=>animTargets().some(({o,a})=>{const an=a&&a.atlas&&curAnim(o);return an&&animFrames(a.atlas,an).length>1;});
function animLoop(t){animRaf=0;if(!cfg.anim||cfg.mode||document.hidden||!hasAnim())return;if(t-animLast>=33){animLast=t;paint();}animRaf=requestAnimationFrame(animLoop);}
function ensureAnim(){if(!animRaf&&cfg.anim&&!cfg.mode&&!document.hidden&&hasAnim())animRaf=requestAnimationFrame(animLoop);}
const restartAnim=()=>{animT0=performance.now();animStart.clear();draw();};
document.addEventListener('visibilitychange',ensureAnim);
function bounds(it){const o=it.o,[x,y]=o.position||[0,0],[sx,sy]=sc(o);
 if(it.k==='c')return charBox(it)||{x:x-150*sx,y:y-400*sy,w:300*sx,h:400*sy};
 const a=findAsset(o.assetPath),f=a&&a.atlas?firstFrame(o,a):null;
 return{x,y,w:(f?f.fw:a?a.w:200)*sx,h:(f?f.fh:a?a.h:200)*sy,a};}
const rect=b=>({x:Math.min(b.x,b.x+b.w),y:Math.min(b.y,b.y+b.h),w:Math.abs(b.w),h:Math.abs(b.h)});
const uniq=n=>{const b=n;let c=1;while(stage.props.some(p=>p&&p.name===n))n=b+(++c);return n;};

/* ---------- History ---------- */
function commit(keep){const s=JSON.stringify(stage);if(s===Hs.last)return;Hs.u.push(Hs.last);if(Hs.u.length>200)Hs.u.shift();Hs.r=[];Hs.last=s;sync(!keep);}
function restore(s){stage=JSON.parse(s);Hs.last=s;if(sel&&!cur())sel=null;sync();}
const undo=()=>{if(Hs.u.length){Hs.r.push(Hs.last);restore(Hs.u.pop());}};
const redo=()=>{if(Hs.r.length){Hs.u.push(Hs.last);restore(Hs.r.pop());}};
const clearVis=()=>{for(const k of Object.keys(charVis))delete charVis[k];for(const k of[...prevAnim.keys()])if(k.startsWith('char:'))prevAnim.delete(k);};
function resetHist(){Hs.u=[];Hs.r=[];Hs.last=JSON.stringify(stage);flags.hid.clear();flags.lock.clear();sel=null;}
function sync(insp=true){renderList();if(insp)renderInsp();jsonSync();$('#undo').disabled=!Hs.u.length;$('#redo').disabled=!Hs.r.length;draw();dirty();}
const live=()=>{draw();jsonSync();dirty();};

/* ---------- Storage (IndexedDB autosave) ---------- */
const idb=(m,f)=>new Promise((res,rej)=>{if(!window.indexedDB)return rej(new Error('IndexedDB unavailable'));const r=indexedDB.open('fnfse',1);
 r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onerror=()=>rej(r.error);
 r.onsuccess=()=>{const t=r.result.transaction('kv',m),q=f(t.objectStore('kv'));t.oncomplete=()=>{res(q.result);r.result.close();};t.onerror=()=>rej(t.error);};});
const fmtSec=n=>n<=0?'off':n%60===0?(n/60)+' min':n+' s';
function syncSaveTip(){$('#save').title='Save project locally (Ctrl+S). Autosave: '+(prefs.autosave>0?'every '+fmtSec(prefs.autosave):'off');}
function armAuto(){if(autoT||!isDirty||!(prefs.autosave>0))return;autoT=setTimeout(()=>{autoT=0;if(isDirty)save();},prefs.autosave*1000);}
function dirty(){isDirty=true;rev++;const s=$('#save');$('#save span').textContent='Unsaved Changes';s.className='warn';armAuto();}
function markClean(){isDirty=false;clearTimeout(autoT);autoT=0;$('#save span').textContent='Saved';$('#save').className='ok';}
const plainVis=()=>JSON.parse(JSON.stringify(charVis));
async function save(manual){clearTimeout(autoT);autoT=0;const r=rev;
 try{await idb('readwrite',s=>s.put({stage:JSON.stringify(stage),assets:assets.map(({name,path,blob,atlas,preview})=>({name,path,blob,preview:!!preview,atlas:atlas?{path:atlas.path,blob:atlas.blob}:null})),charVis:plainVis(),container,cfg:{snap:cfg.snap,grid:cfg.grid,camX:cfg.camX,camY:cfg.camY,anim:cfg.anim}},'project'));
  if(r===rev)markClean();else{$('#save span').textContent='Unsaved Changes';$('#save').className='warn';armAuto();}
  if(manual)toast('Project saved locally in this browser');}
 catch(e){$('#save span').textContent='Save failed';$('#save').className='warn';toast('Cannot save to IndexedDB: '+e.message,1);armAuto();}}
addEventListener('pagehide',()=>{if(isDirty&&prefs.autosave>0)save();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&isDirty&&prefs.autosave>0)save();});
addEventListener('beforeunload',e=>{if(isDirty&&!(prefs.autosave>0)){e.preventDefault();e.returnValue='';}});
async function loadProject(silent){let d;try{d=await idb('readonly',s=>s.get('project'));}catch(e){if(!silent)toast(e.message,1);return false;}
 if(!d){if(!silent)toast('No saved project found',1);return false;}
 try{const s=normalize(JSON.parse(d.stage)),er=validate(s);if(er.length)throw new Error(er[0]);
  clearAssets();for(const a of d.assets||[]){const n=await addImage(a.name,a.path,a.blob);if(n){if(a.preview)n.preview=true;if(a.atlas)await attachAtlas(n,a.atlas.blob,a.atlas.path,true);}}
  clearVis();Object.assign(charVis,d.charVis||{});
  stage=s;container=d.container||null;Object.assign(cfg,d.cfg||{});resetHist();syncCfgUI();renderAssets();sync();markClean();fit();return true;}
 catch(e){toast('Saved project is unreadable: '+e.message,1);return false;}}

/* ---------- Assets ---------- */
function clearAssets(){assets.forEach(a=>a.url&&URL.revokeObjectURL(a.url));assets.length=0;curAsset=null;}
async function addImage(name,path,blob){let shown=blob,astc=null,bad=null;
 if(isAstc(name)){try{const d=await decodeAstc(await blob.arrayBuffer());shown=d.blob;astc={w:d.w,h:d.h,bw:d.bw,bh:d.bh};}
  catch(e){bad=e.message;toast(`ASTC ${name}: ${e.message}. The original file is kept and will be exported unchanged.`,1);}}
 let url=null,img=null;
 if(!bad){url=URL.createObjectURL(shown);img=new Image();img.src=url;
  try{await img.decode();}catch{URL.revokeObjectURL(url);toast('Could not read image: '+name,1);return null;}}
 const o=assets.findIndex(a=>a.path===path);if(o>=0){if(assets[o].url)URL.revokeObjectURL(assets[o].url);assets.splice(o,1);}
 const a={name,base:name.replace(/\.\w+$/,''),path,blob,img,url,astc,bad,w:astc?astc.w:img?img.naturalWidth||100:100,h:astc?astc.h:img?img.naturalHeight||100:100};assets.push(a);return a;}
async function attachAtlas(a,blob,path,silent){const type=atlasKind(path);if(!type)return false;
 try{const at=parseAtlas(await blob.text(),type);at.path=path;at.blob=blob;a.atlas=at;return true;}
 catch(e){if(!silent)toast('Atlas '+path.split('/').pop()+': '+e.message,1);return false;}}
async function attachFiles(fs){let n=0;for(const f of fs){const m=f.name.match(/^(.*)(\.\w+)$/),b=(m?m[1]:f.name).toLowerCase(),a=assets.find(x=>x.base.toLowerCase()===b);
  if(!a){toast(`Upload the image "${m?m[1]:f.name}" first, then add ${f.name}`,1);continue;}
  if(await attachAtlas(a,f,a.path.replace(/\.\w+$/,'')+m[2].toLowerCase()))n++;}
 if(n){toast(n+' atlas file(s) attached');renderAssets();}draw();dirty();}
function detectAnims(a,ex=[]){const used=new Set(ex.map(x=>x&&x.prefix)),names=new Set(ex.map(x=>x&&x.name)),out=[];
 for(const pre of atlasPrefixes(a.atlas)){if(used.has(pre))continue;let n=pre.replace(/[^\w]+$/,'').replace(/\s+/g,'_')||'anim',b=n,c=1;while(names.has(n))n=b+(++c);names.add(n);
  out.push({name:n,prefix:pre,frameRate:24,looped:true,offsets:[0,0]});}
 return out;}
async function uploadImages(fs){for(const f of fs)await addImage(f.name,`images/stages/${slug(stage.name)}/${f.name}`,f);renderAssets();draw();dirty();}
function rmAsset(a){if(a.url)URL.revokeObjectURL(a.url);assets.splice(assets.indexOf(a),1);if(curAsset===a)curAsset=null;renderAssets();draw();dirty();}
function renderAssets(){const L=$('#alist');L.replaceChildren();
 if(!assets.length)L.append(el('p',{className:'hint'},'No assets yet. Upload PNG, JPG, WEBP, SVG or ASTC, plus the matching .xml / .txt atlas for animated props. Files stay in your browser.'));
 for(const a of assets){const c=el('div',{className:'asset'+(a===curAsset?' on':''),draggable:true,tabIndex:0,role:'option'},a.url?el('img',{src:a.url,alt:''}):el('span',{className:'noimg',title:a.bad||''},ic('image')),
  el('span',{},a.name+' ',el('small',{},`${a.astc?`ASTC ${a.astc.bw}×${a.astc.bh} · `:a.bad?'ASTC (cannot decode here) · ':''}${a.w}×${a.h}`+(a.atlas?` · ${a.atlas.type==='sparrow'?'XML':'TXT'} ${a.atlas.frames.length} frames`:'')+(a.preview?' · preview only (not exported)':''))),el('button',{className:'ib','title':'Remove asset','aria-label':'Remove asset '+a.name,onclick:e=>{e.stopPropagation();rmAsset(a);}},ic('x')));
  c.ondragstart=e=>e.dataTransfer.setData('text/plain',a.path);c.onclick=()=>{curAsset=a;renderAssets();};c.ondblclick=()=>addProp(a);
  c.onkeydown=e=>{if(e.key==='Enter')addProp(a);};L.append(c);}}

/* ---------- Object operations ---------- */
function addProp(a,x,y){if(a.preview){a.preview=false;toast('This asset was preview-only; it is now included in exports.');}
const z=Math.max(0,...stage.props.map(p=>+p.zIndex||0))+10;
 const o={name:uniq(a.base),assetPath:a.path.replace(/^images\//,'').replace(/\.\w+$/,''),zIndex:z,position:[sn(x??view.x-a.w/2),sn(y??view.y-a.h/2)],scale:[1,1],scroll:[1,1],alpha:1,isPixel:false};
 if(a.atlas){o.animType=a.atlas.type;const an=detectAnims(a);if(an.length){o.animations=an;o.startingAnimation=an[0].name;}}
 stage.props.push(o);
 sel={k:'p',i:stage.props.length-1};commit();}
function addChar(){const id=['bf','dad','gf'].find(i=>!stage.characters[i]);if(!id)return toast('BF, DAD and GF slots are all in use',1);
 stage.characters[id]=newChar(id);sel={k:'c',id};commit();}
function dup(it){if(it.k!=='p')return toast('Character slots cannot be duplicated',1);const c=JSON.parse(JSON.stringify(it.o)),p=c.position||[0,0];
 c.name=uniq(c.name||'prop');c.position=[p[0]+20,p[1]+20];stage.props.push(c);sel={k:'p',i:stage.props.length-1};commit();}
function del(it){if(it.k==='p')stage.props.splice(it.i,1);else delete stage.characters[it.id];sel=null;commit();}
const zmove=(it,d)=>{it.o.zIndex=(+it.o.zIndex||0)+d;commit();};
const tog=(k,it)=>{flags[k].has(it.key)?flags[k].delete(it.key):flags[k].add(it.key);renderList();draw();};
function ren(it){if(it.k!=='p')return toast('Character slot keys (bf/dad/gf) cannot be renamed',1);const n=prompt('New name',it.o.name);if(n){it.o.name=n;commit();}}
function nudge(dx,dy,big){const c=cur();if(!c||flags.lock.has(c.key))return;const s=(cfg.snap>0?cfg.snap:1)*(big?5:1),p=c.o.position||(c.o.position=[0,0]);
 p[0]+=dx*s;p[1]+=dy*s;draw();jsonSync();clearTimeout(mvT);mvT=setTimeout(()=>commit(),350);}

/* ---------- Left panel ---------- */
const ib=(n,l,f)=>el('button',{className:'ib',title:l,'aria-label':l,onclick:e=>{e.stopPropagation();f();}},ic(n));
function renderList(){const L=$('#list');L.replaceChildren();
 for(const it of objs().reverse()){const s=same(it),nm=it.k==='p'?(it.o.name||'(unnamed)'):it.id.toUpperCase();
  const row=el('div',{className:'row'+(s?' on':''),tabIndex:0,role:'option','aria-selected':String(s),onclick:()=>pick(it),onkeydown:e=>{if(e.key==='Enter')pick(it);}});
  row.append(el('div',{className:'top'},el('span',{className:'nm'},ic(it.k==='c'?'user':'image','mk'),nm),el('small',{},'z'+(+it.o.zIndex||0)),
   ib(flags.hid.has(it.key)?'eyeOff':'eye','Show / hide',()=>tog('hid',it)),ib(flags.lock.has(it.key)?'lock':'unlock','Lock / unlock',()=>tog('lock',it))));
  if(s)row.append(el('div',{className:'top'},ib('up','Z-index +10',()=>zmove(it,10)),ib('down','Z-index −10',()=>zmove(it,-10)),ib('copy','Duplicate',()=>dup(it)),ib('edit','Rename',()=>ren(it)),ib('trash','Delete',()=>del(it))));
  L.append(row);}
 if(!L.children.length)L.append(el('p',{className:'hint'},'The stage is empty.'));}

/* ---------- Inspector ---------- */
const fld=(l,...k)=>el('div',{className:'f'},el('span',{},l),el('div',{className:'in'},...k));
function nf(l,o,key,def,{step=1,range}={}){const v=()=>Number.isFinite(+o[key])&&o[key]!==null?+o[key]:def;
 const n=el('input',{type:'number',step,value:v(),'aria-label':l}),r=range&&el('input',{type:'range',min:range[0],max:range[1],step,value:v(),'aria-label':l+' slider'});
 const set=x=>{if(Number.isFinite(x)){o[key]=x;live();}};
 n.oninput=()=>{set(parseFloat(n.value));if(r)r.value=n.value;};n.onchange=()=>commit(true);
 if(r){r.oninput=()=>{n.value=r.value;set(parseFloat(r.value));};r.onchange=()=>commit(true);}
 return fld(l,n,...(r?[r]:[]));}
function pf(l,o,key,def,{step=1,uni}={}){const g=()=>{const v=o[key];return Array.isArray(v)?v.slice():typeof v==='number'?[v,v]:def.slice();};
 const ins=[0,1].map(i=>{const n=el('input',{type:'number',step,value:g()[i],'aria-label':l+(i?' Y':' X')});
  n.oninput=()=>{const v=parseFloat(n.value);if(Number.isFinite(v)){const a=g();a[i]=v;o[key]=a;live();}};n.onchange=()=>commit(true);return n;});
 const kids=[...ins];
 if(uni){const r=el('input',{type:'range',min:uni[0],max:uni[1],step:.01,value:g()[0],'aria-label':l+' uniform slider'});
  r.oninput=()=>{const v=parseFloat(r.value);o[key]=[v,v];ins.forEach(n=>n.value=v);live();};r.onchange=()=>commit(true);kids.push(r);}
 return fld(l,...kids);}
function tf(l,o,key,relist){const n=el('input',{type:'text',value:o[key]??'','aria-label':l});n.oninput=()=>{o[key]=n.value;live();};n.onchange=()=>{commit(true);if(relist)renderList();};return fld(l,n);}
function cfgf(l,key){const n=el('input',{type:'number',value:cfg[key],'aria-label':l});n.oninput=()=>{const v=parseFloat(n.value);if(Number.isFinite(v)){cfg[key]=v;draw();dirty();}};return fld(l,n);}
const cbf=(l,o,key,def)=>fld(l,el('input',{type:'checkbox',checked:o[key]===undefined?def:!!o[key],'aria-label':l,onchange:e=>{o[key]=e.target.checked;commit(true);}}));
const self=(l,opts,val,fn)=>{const s=el('select',{'aria-label':l});for(const[v,t]of opts)s.append(el('option',{value:v,textContent:t}));s.value=val;s.onchange=()=>fn(s.value);return fld(l,s);};
function animUI(I,o){const a=findAsset(o.assetPath),at=a&&a.atlas,list=Array.isArray(o.animations)?o.animations:null;
 if(!at&&!list)return;
 I.append(el('h3',{},'Animation'));
 if(!at)I.append(el('p',{className:'hint'},'No .xml / .txt atlas is loaded for this asset, so animations cannot be previewed. Upload it in the Assets tab (same file name as the image).'));
 const names=(list||[]).map(x=>x&&x.name).filter(Boolean);
 I.append(self('Atlas type',[['sparrow','Sparrow (.xml)'],['packer','Packer (.txt)']],o.animType||(at&&at.type)||'sparrow',v=>{o.animType=v;commit(true);}),
  startSel(),
  nf('Dance every',o,'danceEvery',0,{step:.5}));
 function startSel(){return self('Start anim',[['','(none)'],...names.map(n=>[n,n])],o.startingAnimation||'',v=>{if(v)o.startingAnimation=v;else delete o.startingAnimation;prevAnim.delete(o.name);restartAnim();commit(true);});}
 if(at&&names.length)I.append(self('Preview',names.map(n=>[n,n]),(curAnim(o)||{}).name||names[0],v=>{prevAnim.set(o.name,v);restartAnim();ensureAnim();}));
 const dl=el('datalist',{id:'pfx'},...(at?atlasPrefixes(at):[]).map(x=>el('option',{value:x})));I.append(dl);
 (list||[]).forEach((an,i)=>{if(!an||typeof an!=='object')return;
  const nm=el('input',{type:'text',value:an.name??'','aria-label':'Animation name'});let old=an.name;
  nm.oninput=()=>{an.name=nm.value;live();};
  nm.onchange=()=>{if(o.startingAnimation===old)o.startingAnimation=an.name;if(prevAnim.get(o.name)===old)prevAnim.set(o.name,an.name);old=an.name;commit();renderInsp();};
  const fc=at?animFrames(at,an).length:0;
  const card=el('div',{className:'an'},el('div',{className:'top'},nm,el('small',{},at?fc+' fr':''),
   ib('trash','Delete animation',()=>{list.splice(i,1);if(o.startingAnimation===an.name)delete o.startingAnimation;commit();})));
  const px=el('input',{type:'text',value:an.prefix??'','aria-label':'Prefix'});px.setAttribute('list','pfx');
  px.oninput=()=>{an.prefix=px.value;live();};px.onchange=()=>{commit();renderInsp();};
  const ix=el('input',{type:'text',value:(an.frameIndices||[]).join(','),placeholder:'all frames, or 0,1,2,3','aria-label':'Frame indices'});
  ix.oninput=()=>{const v=ix.value.split(/[\s,]+/).filter(Boolean).map(Number);if(v.every(Number.isFinite)){if(v.length)an.frameIndices=v;else delete an.frameIndices;live();}};ix.onchange=()=>{commit();renderInsp();};
  card.append(fld('Prefix',px),nf('Frame rate',an,'frameRate',24,{step:1}),cbf('Looped',an,'looped',true),pf('Offsets',an,'offsets',[0,0]),fld('Indices',ix),cbf('Flip X',an,'flipX',false),cbf('Flip Y',an,'flipY',false));
  I.append(card);});
 I.append(el('div',{className:'acts'},
  el('button',{textContent:'+ Anim',title:'Add animation',onclick:()=>{if(!Array.isArray(o.animations))o.animations=[];let n='anim',c=1;while(o.animations.some(x=>x&&x.name===n))n='anim'+(++c);
    o.animations.push({name:n,prefix:'',frameRate:24,looped:true,offsets:[0,0]});if(!o.startingAnimation)o.startingAnimation=n;if(!o.animType&&at)o.animType=at.type;commit();}}),
  ...(at?[el('button',{className:'pri',textContent:'Detect',title:'Detect animations from atlas',onclick:()=>{const add=detectAnims(a,list||[]);if(!add.length)return toast('No new prefixes found in the atlas');
    if(!Array.isArray(o.animations))o.animations=[];o.animations.push(...add);if(!o.animType)o.animType=at.type;if(!o.startingAnimation)o.startingAnimation=add[0].name;commit();toast(add.length+' animation(s) added');}}),
   el('button',{textContent:'Restart',onclick:restartAnim})]:[])));}
function charRows(I){I.append(el('h3',{},'Character preview'));
 for(const id of['bf','dad','gf']){const has=!!stage.characters[id],ci=charInfo(id),note=ci?charNote(id):'';
  const st=!has?'slot not in stage':!ci?'placeholder box':(ci.d.name||baseName(ci.d.assetPath))+(note||' · sprite ready'),cls=!has||!ci?'':note?'er':'ok';
  I.append(el('div',{className:'cprow'},el('b',{textContent:id.toUpperCase(),title:'Select '+id,onclick:()=>{if(has)pick({k:'c',id});}}),el('span',{className:'cs '+cls,title:st},st),
   ib('folder','Insert character JSON / sprite files',()=>insertChar(id)),
   ci?ib('x','Remove visual (back to placeholder)',()=>{delete charVis[id];prevAnim.delete('char:'+id);visChanged();}):el('span')));}
 I.append(el('p',{className:'hint'},'Pick a character .json (with its .png/.astc and .xml) to see it on stage and set where it stands. This is preview-only: it is never written into the Stage JSON.'));}
function charUI(I,id){const ci=charInfo(id),vp=ci&&charProp(id);I.append(el('h3',{},'Visual: '+id.toUpperCase()));
 const sp=el('select',{'aria-label':'Sprite asset'});sp.append(el('option',{value:'',textContent:ci?'(auto: from assetPath)':'(placeholder box)'}));
 for(const a of assets)sp.append(el('option',{value:a.path,textContent:a.name+(a.preview?' (preview)':'')+(a.atlas?' + atlas':'')}));
 sp.value=ci&&ci.v.assetKey&&assets.some(a=>a.path===ci.v.assetKey)?ci.v.assetKey:'';
 sp.onchange=()=>{const a=assets.find(x=>x.path===sp.value);
  if(!ci){if(a)useAssetVisual(id,a);else return;}else if(a)ci.v.assetKey=a.path;else delete ci.v.assetKey;visChanged();};
 I.append(fld('Sprite asset',sp),el('div',{className:'acts'},el('button',{className:'pri',textContent:'Insert JSON / sprites',onclick:()=>insertChar(id)}),
  ...(ci?[el('button',{textContent:'Clear',onclick:()=>{delete charVis[id];prevAnim.delete('char:'+id);visChanged();}})]:[])));
 if(!ci){I.append(el('p',{className:'hint'},'Choose an uploaded asset above, or insert a character JSON to preview the real character.'));return;}
 const d=ci.d,b=baseName(d.assetPath),note=charNote(id);
 I.append(el('p',{className:'cinfo '+(note?'er':'ok')},note?`Sprite problem${note.replace(' · ',': ')}`:`Sprite: ${ci.a.name}${ci.a.atlas?` + atlas (${ci.a.atlas.frames.length} frames)`:''}`),
  el('p',{className:'cinfo'},`${d.name||b} · ${d.renderType||'static'} · assetPath ${d.assetPath}`+(d.healthIcon&&d.healthIcon.id?` · icon ${d.healthIcon.id}`:'')+(d.singTime!==undefined?` · singTime ${d.singTime}`:'')));
 if(/atlas/i.test(d.renderType||''))I.append(el('p',{className:'cinfo er'},'Adobe Animate atlases cannot be previewed here; the sprite sheet is shown as a placeholder.'));
 I.append(fld('Use JSON offsets',el('input',{type:'checkbox',checked:!!ci.v.useOffsets,'aria-label':'Use JSON offsets',onchange:e=>{ci.v.useOffsets=e.target.checked;draw();dirty();}})),pf('Char offsets',d,'offsets',[0,0]),nf('Char scale',d,'scale',1,{step:.01,range:[.05,5]}),
  fld('Flip X',el('input',{type:'checkbox',checked:!!ci.v.flipX,'aria-label':'Flip X',onchange:e=>{ci.v.flipX=e.target.checked;draw();dirty();}})));
 const names=(Array.isArray(d.animations)?d.animations:[]).map(x=>x&&x.name).filter(Boolean);
 if(names.length&&ci.a&&ci.a.atlas)I.append(self('Preview anim',names.map(n=>[n,n]),(curAnim(vp)||{}).name||names[0],v=>{prevAnim.set('char:'+id,v);restartAnim();ensureAnim();}),
  el('div',{className:'acts'},el('button',{textContent:'Restart',onclick:restartAnim})));
 I.append(el('div',{className:'acts'},el('button',{textContent:'Export character JSON',onclick:()=>dl(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),(d.name||id)+'.json')})),
  el('p',{className:'hint'},'Stage position = where the feet stand. The JSON offsets are only applied if "Use JSON offsets" is on (off by default, so the position comes from the stage only). Scale and offsets are edited here; exporting saves them to the character JSON.'));}
function renderInsp(){const I=$('#insp');I.replaceChildren();
 I.append(el('h3',{},'Stage'),tf('Name',stage,'name'),nf('Camera zoom',stage,'cameraZoom',1,{step:.01,range:[.2,3]}),cfgf('Cam X','camX'),cfgf('Cam Y','camY'),
  fld('Camera preview',el('input',{type:'checkbox',checked:cfg.cam,'aria-label':'Camera preview',onchange:e=>{cfg.cam=e.target.checked;draw();}}),
   el('button',{textContent:'Reset camera',onclick:()=>{cfg.camX=640;cfg.camY=360;stage.cameraZoom=1;commit();}})),
  el('p',{className:'hint'},'Camera X/Y only positions the preview frame; the Stage JSON stores just cameraZoom.'));
 charRows(I);
 const c=cur();if(!c){I.append(el('p',{className:'hint'},'Select an object in the viewport or list to edit it.'));return;}
 const o=c.o;I.append(el('h3',{},c.k==='p'?'Prop':'Character: '+c.id.toUpperCase()));
 if(c.k==='p')I.append(tf('Name',o,'name',true),tf('Asset path',o,'assetPath'));
 I.append(pf('Position',o,'position',[0,0]),pf('Scale',o,'scale',[1,1],{step:.01,uni:[.05,5]}));
 if(c.k==='p')I.append(pf('Scroll',o,'scroll',[1,1],{step:.01,uni:[0,2]}),nf('Alpha',o,'alpha',1,{step:.01,range:[0,1]}));else I.append(pf('Camera offsets',o,'cameraOffsets',[0,0]));
 I.append(nf('Z index',o,'zIndex',0,{range:[-100,500]}));
 if(c.k==='p')I.append(fld('Pixel mode',el('input',{type:'checkbox',checked:!!o.isPixel,'aria-label':'Pixel mode',onchange:e=>{o.isPixel=e.target.checked;commit(true);}})));
 if(c.k==='p')animUI(I,o);else charUI(I,c.id);
 const known=['name','assetPath','position','scale','scroll','zIndex','isPixel','cameraOffsets','alpha','animType','startingAnimation','danceEvery','animations'],ex=Object.keys(o).filter(k=>!known.includes(k));
 if(ex.length)I.append(el('p',{className:'hint'},'Extra fields preserved: '+ex.join(', ')));}
function tab(t){document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.t===t)));document.querySelectorAll('.tp').forEach(p=>p.hidden=p.id!=='t-'+t);if(t==='json')jsonSync(true);}
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>tab(b.dataset.t));
const openR=()=>$('#app').classList.remove('hr');

/* ---------- JSON editor ---------- */
function jerr(m,ok){const e=$('#jerr');e.textContent=m;e.className=ok?'ok':'er';}
function jsonSync(force){if($('#t-json').hidden&&!force)return;if(force||document.activeElement!==js){js.value=JSON.stringify(stage,null,2);jerr('');}}
function parseJ(t){try{return{v:JSON.parse(t)};}catch(e){const m=/position (\d+)/.exec(e.message),l=/line (\d+)/.exec(e.message);
 return{err:(m?`Line ${t.slice(0,+m[1]).split('\n').length}: `:l?`Line ${l[1]}: `:'')+e.message};}}
js.oninput=()=>{const r=parseJ(js.value);r.err?jerr(r.err):jerr('Valid JSON',1);};
$('#jfmt').onclick=()=>{const r=parseJ(js.value);if(r.err)return jerr(r.err);js.value=JSON.stringify(r.v,null,2);jerr('Formatted',1);};
$('#jrst').onclick=()=>jsonSync(true);
$('#japp').onclick=()=>{const r=parseJ(js.value);if(r.err)return jerr(r.err);const s=normalize(r.v),er=validate(s);if(er.length)return jerr(er.join('; '));
 stage=s;if(sel&&!cur())sel=null;commit();jsonSync(true);jerr('Applied',1);};

/* ---------- Insert character JSON + sprite files ---------- */
let charTarget=null;
const isImg=f=>/^image\//.test(f.type)||/\.(png|jpe?g|webp|svg|astc)$/i.test(f.name);
function insertChar(id){if(!stage.characters[id])return toast('Add the '+id.toUpperCase()+' slot first',1);charTarget=id;$('#cfile').click();}
async function isCharJson(f){try{const j=JSON.parse(await f.text());return!charDataError(j);}catch{return false;}}
async function insertCharFiles(id,fs){if(!stage.characters[id])return toast('Add the '+id.toUpperCase()+' slot first',1);
 let data=null;const imgs=[],atl=[];
 for(const f of fs){if(/\.json$/i.test(f.name)){try{const j=JSON.parse(await f.text()),er=charDataError(j);if(er)toast(`${f.name}: ${er}`,1);else data=j;}catch(e){toast(`${f.name}: invalid JSON (${e.message})`,1);}}
  else if(/\.(xml|txt)$/i.test(f.name))atl.push(f);else if(isImg(f))imgs.push(f);else toast('Unsupported file: '+f.name,1);}
 if(!data&&!imgs.length&&!atl.length)return;
 const ap=(data&&data.assetPath)||(charVis[id]&&charVis[id].data.assetPath)||'';
 for(const f of imgs){const m=f.name.match(/^(.*)(\.\w+)$/),b=m?m[1]:f.name,e=m?m[2]:'';
  const path=ap&&baseName(ap).toLowerCase()===b.toLowerCase()?`images/${ap}${e}`:`images/characters/${f.name}`;
  const a=await addImage(f.name,path,f);if(a)a.preview=true;}
 if(atl.length)await attachFiles(atl);
 if(data){charVis[id]={src:'json',data,flipX:!!data.flipX};prevAnim.delete('char:'+id);}
 visChanged();
 const ci=charInfo(id);
 if(data)toast(`${id.toUpperCase()}: ${data.name||baseName(data.assetPath)} inserted`+(charNote(id)?'.'+charNote(id).replace(' · ',' '):''),!!charNote(id));
 else toast(ci?'Sprite files added'+(charNote(id)?'.'+charNote(id).replace(' · ',' '):''):'Sprite files added (preview only). Now insert a character JSON or choose it as the visual.');}
$('#cfile').onchange=async e=>{const fs=[...e.target.files];e.target.value='';if(fs.length&&charTarget)await insertCharFiles(charTarget,fs);};

/* ---------- Files ---------- */
async function openFile(f){let c;try{c=await openContainer(await f.arrayBuffer());}catch(e){toast(e.message,1);return;}
 const s=normalize(c.stage),er=validate(s);if(er.length){toast('Invalid stage: '+er[0]+(er.length>1?` (+${er.length-1} more)`:''),1);return;}
 clearAssets();clearVis();container=c.entries.length?{jsonPath:c.jsonPath,extra:c.extra,ext:(f.name.match(/\.(\w+)$/)||[])[1]||'zip'}:null;
 for(const im of c.images)await addImage(im.path.split('/').pop(),im.path,new Blob([im.data],{type:mime(im.path)}));
 for(const at of c.atlases||[]){const st=x=>x.replace(/\.\w+$/,'').toLowerCase(),a=assets.find(x=>st(x.path)===st(at.path))||assets.find(x=>x.base.toLowerCase()===st(at.path.split('/').pop()));
  if(!(a&&await attachAtlas(a,new Blob([at.data]),at.path,true)))c.extra.push(at);}
 stage=s;resetHist();renderAssets();sync();fit();
 if(c.entries.length)modal('Container: '+f.name,el('p',{},`${c.entries.length} files found. Stage JSON in use: ${c.jsonPath}`),
  el('ul',{className:'tree'},...c.entries.map(e=>el('li',{className:e.path===c.jsonPath?'hit':''},`${e.path} (${e.kind}, ${e.size} B)`))));
 else toast('Stage loaded');}
async function handleFiles(fs){const imgs=[],atl=[],chr=[];for(const f of fs){if(/\.json$/i.test(f.name)&&await isCharJson(f)){chr.push(f);continue;}
  if(/\.(fnfs|zip|json)$/i.test(f.name))await openFile(f);
  else if(/\.(xml|txt)$/i.test(f.name))atl.push(f);
 else if(/^image\//.test(f.type)||/\.(png|jpe?g|webp|svg|astc)$/i.test(f.name))imgs.push(f);else toast('Unsupported file: '+f.name,1);}
 if(chr.length){const id=sel&&sel.k==='c'?sel.id:null;
  if(!id){toast('That is a character JSON. Select BF, Dad or GF first (or use Insert in the Inspector), then open it again.',1);return;}
  await insertCharFiles(id,[...chr,...imgs,...atl]);openR();tab('vis');return;}
 if(imgs.length){await uploadImages(imgs);tab('ast');}
 if(atl.length){await attachFiles(atl);tab('ast');}}
$('#file').onchange=async e=>{const fs=[...e.target.files];e.target.value='';if(fs.length)await handleFiles(fs);};
const okExport=()=>{const er=validate(stage);if(er.length){toast('Cannot export: '+er.join('; '),1);return false;}return true;};
on('export',()=>{const ext=(container&&container.ext)||'zip';
 modal('Export',el('p',{},'JSON is validated before export. Unknown fields are kept. The package is a ZIP with the Stage JSON plus your assets.'),
  el('button',{className:'pri',textContent:'Export Stage JSON',onclick:()=>{if(okExport())dl(new Blob([JSON.stringify(stage,null,2)],{type:'application/json'}),slug(stage.name)+'.json');}}),
  el('button',{textContent:'Export Package (.'+ext+')',onclick:async()=>{if(!okExport())return;try{dl(await buildPackage(stage,assets,container),slug(stage.name)+'.'+ext);}catch(e){toast('Package failed: '+e.message,1);}}}));});
on('new',()=>{if(!confirm('Start a new stage? Unexported changes in the editor will be lost.'))return;clearAssets();clearVis();stage=DEFAULT_STAGE();container=null;resetHist();renderAssets();sync();fit();});
on('open',()=>$('#file').click());on('upl',()=>$('#file').click());on('save',()=>save(true));on('undo',undo);on('redo',redo);
on('addp',()=>{if(curAsset)addProp(curAsset);else{openR();tab('ast');toast(assets.length?'Select an asset, then tap Add to stage':'Upload an image asset first');if(!assets.length)$('#file').click();}});
on('addsel',()=>curAsset?addProp(curAsset):toast('Select an asset first',1));on('addc',addChar);
on('tl',()=>$('#app').classList.toggle('hl'));on('tr',()=>$('#app').classList.toggle('hr'));
function autosaveField(){const O=[[0,'Off'],[15,'Every 15 s'],[30,'Every 30 s'],[60,'Every 1 min (default)'],[120,'Every 2 min'],[300,'Every 5 min'],[600,'Every 10 min']];
 if(!O.some(o=>o[0]===prefs.autosave))O.push([prefs.autosave,'Every '+fmtSec(prefs.autosave)]);O.push(['c','Custom…']);
 const f=self('Autosave',O.map(([v,t])=>[String(v),t]),String(prefs.autosave),v=>{let n=v==='c'?parseFloat(prompt('Autosave every how many seconds? (5 to 3600, 0 = off)',prefs.autosave||60)):+v;
  if(!Number.isFinite(n)||n<0||(n>0&&n<5)||n>3600){toast('Enter 0 (off) or a value from 5 to 3600 seconds',1);n=prefs.autosave;}
  setPref('autosave',Math.round(n));clearTimeout(autoT);autoT=0;armAuto();syncSaveTip();
  toast(n>0?'Autosave every '+fmtSec(Math.round(n)):'Autosave off. Use Save or Ctrl+S; the editor will warn before closing with unsaved changes.');
  if(v==='c')on_set();});return f;}
const on_set=()=>modal('Settings',autosaveField(),el('p',{className:'hint'},'Saves to this browser (IndexedDB), only when there are changes. A save is also attempted when the page is hidden or closed, unless autosave is off.'),el('button',{textContent:'Save project (local)',onclick:()=>save(true)}),
 el('button',{textContent:'Load saved project',onclick:async()=>{if(await loadProject(false))toast('Project loaded');}}),
 el('button',{textContent:'Clear local project',onclick:async()=>{if(!confirm('Delete the project saved in this browser?'))return;try{await idb('readwrite',s=>s.delete('project'));toast('Local project cleared');}catch(e){toast(e.message,1);}}}),
 el('p',{className:'hint'},'Everything runs locally; nothing is uploaded. Animated props: upload the .png together with its .xml (Sparrow) or .txt (Packer) atlas, then use Detect in the Inspector. Touch: drag to move, drag the pink corner to scale, drag empty space to pan, pinch to zoom, double-tap an object to open Inspector. Desktop: WASD/arrows (Shift = faster), Ctrl+Z/Y, Ctrl+D, Delete, G grid, F fullscreen, Space preview, Alt+drag or middle mouse to pan.'));
on('set',on_set);
vp.ondragover=e=>e.preventDefault();
vp.ondrop=async e=>{e.preventDefault();const r=cv.getBoundingClientRect(),[x,y]=s2w(e.clientX-r.left,e.clientY-r.top),a=assets.find(a=>a.path===e.dataTransfer.getData('text/plain'));
 if(a)return addProp(a,x,y);if(e.dataTransfer.files.length)await handleFiles([...e.dataTransfer.files]);};

/* ---------- Viewport ---------- */
const w2s=(x,y)=>[(x-V.x)*V.z+VW/2,(y-V.y)*V.z+VH/2],s2w=(x,y)=>[(x-VW/2)/V.z+V.x,(y-VH/2)/V.z+V.y];
function resize(){const r=vp.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);VW=r.width;VH=r.height;cv.width=Math.round(VW*dpr);cv.height=Math.round(VH*dpr);draw();}
function draw(){if(!pend)pend=requestAnimationFrame(()=>{pend=0;paint();});ensureAnim();}
function paint(){if(!VW)return;cx.setTransform(dpr,0,0,dpr,0,0);const p=cfg.mode,cz=(+stage.cameraZoom||1)+(p?bump:0);
 V=p?{x:cfg.camX,y:cfg.camY,z:Math.min(VW/(1280/cz),VH/(720/cz))}:view;
 cx.fillStyle='#0f0c1a';cx.fillRect(0,0,VW,VH);if(!p&&cfg.grid)grid();
 for(const it of objs())if(!flags.hid.has(it.key))drawObj(it);
 const w=1280/cz,h=720/cz,[fx,fy]=w2s(cfg.camX-w/2,cfg.camY-h/2);
 if(p){cx.fillStyle='#000';cx.beginPath();cx.rect(0,0,VW,VH);cx.rect(fx,fy,w*V.z,h*V.z);cx.fill('evenodd');}
 else{axes();if(cfg.cam){cx.strokeStyle='#4fd1ff';cx.setLineDash([8,6]);cx.lineWidth=2;cx.strokeRect(fx,fy,w*V.z,h*V.z);cx.setLineDash([]);cx.fillStyle='#4fd1ff';cx.font='11px sans-serif';cx.fillText(`camera 1280×720 @ ${cz.toFixed(2)}`,fx+6,fy+14);}selBox();rulers();}
 $('#zoom').textContent=Math.round(V.z*100)+'%';}
function grid(){let st=cfg.snap>0?cfg.snap:10;while(st*V.z<12)st*=2;const[ox,oy]=s2w(0,0),[ex,ey]=s2w(VW,VH);cx.strokeStyle='#ffffff12';cx.lineWidth=1;cx.beginPath();
 for(let x=Math.floor(ox/st)*st;x<=ex;x+=st){const s=Math.round(w2s(x,0)[0])+.5;cx.moveTo(s,0);cx.lineTo(s,VH);}
 for(let y=Math.floor(oy/st)*st;y<=ey;y+=st){const s=Math.round(w2s(0,y)[1])+.5;cx.moveTo(0,s);cx.lineTo(VW,s);}cx.stroke();}
function drawFrame(it,b,sx,sy){const o=b.vp||it.o,{fr,an}=animFrame(o,b.a,it.key,performance.now());if(!fr)return;
 const[kx,ky]=sc(o),z=V.z,off=an&&Array.isArray(an.offsets)?an.offsets:[0,0],dw=fr.w*kx*z,dh=fr.h*ky*z,
  dx=sx+(-fr.fx*kx-(+off[0]||0))*z,dy=sy+(-fr.fy*ky-(+off[1]||0))*z,fx=!!(an&&an.flipX)!==!!b.flip,fy=an&&an.flipY;
 cx.save();
 if(fx||fy){const mx=sx+b.w*z/2,my=sy+b.h*z/2;cx.translate(mx,my);cx.scale(fx?-1:1,fy?-1:1);cx.translate(-mx,-my);}
 if(fr.rot){cx.translate(dx,dy+dh);cx.rotate(-Math.PI/2);cx.drawImage(b.a.img,fr.x,fr.y,fr.h,fr.w,0,0,dh,dw);}
 else cx.drawImage(b.a.img,fr.x,fr.y,fr.w,fr.h,dx,dy,dw,dh);
 cx.restore();}
const CCOL={bf:'#4fa8ff',dad:'#b57bff',gf:'#ff6fae'};
function charTag(it){if(cfg.mode)return;const col=CCOL[it.id]||'#9aa5b1',[px,py]=w2s(...(it.o.position||[0,0])),t=it.id.toUpperCase();
 cx.globalAlpha=1;cx.fillStyle=col;cx.beginPath();cx.arc(px,py,4,0,7);cx.fill();cx.font='700 11px sans-serif';const w=cx.measureText(t).width+8;
 cx.fillRect(px+7,py-9,w,16);cx.fillStyle='#10091c';cx.fillText(t,px+11,py+3);}
function drawObj(it){const b=bounds(it),[sx,sy]=w2s(b.x,b.y);cx.globalAlpha=it.k==='p'?alphaOf(it.o):1;
 if(it.k==='c'&&b.a&&b.a.img){const ci=charInfo(it.id);cx.imageSmoothingEnabled=!(ci&&ci.d.isPixel);
  if(b.a.atlas)drawFrame(it,b,sx,sy);
  else{cx.save();if(b.flip){const mx=sx+b.w*V.z/2;cx.translate(mx,0);cx.scale(-1,1);cx.translate(-mx,0);}cx.drawImage(b.a.img,sx,sy,b.w*V.z,b.h*V.z);cx.restore();}
  charTag(it);cx.globalAlpha=1;return;}
 if(it.k==='p'&&b.a&&b.a.img){cx.imageSmoothingEnabled=!it.o.isPixel;if(b.a.atlas)drawFrame(it,b,sx,sy);else cx.drawImage(b.a.img,sx,sy,b.w*V.z,b.h*V.z);cx.globalAlpha=1;return;}
 const r=rect(b),[rx,ry]=w2s(r.x,r.y),col=it.k==='c'?({bf:'#4fa8ff',dad:'#b57bff',gf:'#ff6fae'}[it.id]||'#9aa5b1'):'#888';
 cx.fillStyle=col+'44';cx.strokeStyle=col;cx.lineWidth=2;cx.setLineDash(it.k==='p'?[6,4]:[]);cx.fillRect(rx,ry,r.w*V.z,r.h*V.z);cx.strokeRect(rx,ry,r.w*V.z,r.h*V.z);cx.setLineDash([]);
 cx.fillStyle='#fff';cx.font='600 13px sans-serif';cx.fillText(it.k==='c'?it.id.toUpperCase()+charNote(it.id):(b.a&&b.a.bad?'Cannot decode: ':'Missing asset: ')+(it.o.assetPath||''),rx+6,ry+18);
 if(it.k==='c'){const[px,py]=w2s(...(it.o.position||[0,0]));cx.beginPath();cx.arc(px,py,4,0,7);cx.fill();}
 cx.globalAlpha=1;}
function axes(){const[x,y]=w2s(0,0);cx.strokeStyle=cx.fillStyle='#ff4f9a';cx.lineWidth=1;cx.beginPath();cx.moveTo(x-12,y);cx.lineTo(x+12,y);cx.moveTo(x,y-12);cx.lineTo(x,y+12);cx.stroke();cx.font='11px sans-serif';cx.fillText('0,0',x+6,y-6);}
const HS=()=>matchMedia('(pointer:coarse)').matches?18:10;
function selBox(){const c=cur();if(!c||flags.hid.has(c.key))return;const r=rect(bounds(c)),[x,y]=w2s(r.x,r.y),w=r.w*V.z,h=r.h*V.z;
 cx.strokeStyle=cx.fillStyle='#ff4f9a';cx.lineWidth=2;cx.strokeRect(x,y,w,h);if(!flags.lock.has(c.key)){const s=HS()*1.2;cx.fillRect(x+w-s/2,y+h-s/2,s,s);}}
function rulers(){let st=cfg.snap>0?cfg.snap:10;while(st*V.z<60)st*=2;const[ox,oy]=s2w(0,0),[ex,ey]=s2w(VW,VH);
 cx.fillStyle='#1c1730dd';cx.fillRect(0,0,VW,16);cx.fillRect(0,0,16,VH);cx.fillStyle='#a79dd0';cx.font='10px sans-serif';
 for(let x=Math.ceil(ox/st)*st;x<=ex;x+=st)cx.fillText(x,w2s(x,0)[0]+2,11);
 for(let y=Math.ceil(oy/st)*st;y<=ey;y+=st)cx.fillText(y,1,w2s(0,y)[1]-2);}
function hit(px,py){const[wx,wy]=s2w(px,py);for(const it of objs().reverse()){if(flags.hid.has(it.key)||flags.lock.has(it.key))continue;const r=rect(bounds(it));if(wx>=r.x&&wx<=r.x+r.w&&wy>=r.y&&wy<=r.y+r.h)return it;}return null;}
function fit(){const l=objs().filter(i=>!flags.hid.has(i.key)).map(i=>rect(bounds(i)));let x0=0,y0=0,x1=1280,y1=720;
 if(l.length){x0=Math.min(...l.map(r=>r.x));y0=Math.min(...l.map(r=>r.y));x1=Math.max(...l.map(r=>r.x+r.w));y1=Math.max(...l.map(r=>r.y+r.h));}
 view.z=clamp(Math.min(VW/Math.max(x1-x0,100),VH/Math.max(y1-y0,100))*.9,.05,4);view.x=(x0+x1)/2;view.y=(y0+y1)/2;draw();}
function zoomAt(p,k){const[wx,wy]=s2w(p.x,p.y);view.z=clamp(view.z*k,.05,8);view.x=wx-(p.x-VW/2)/view.z;view.y=wy-(p.y-VH/2)/view.z;draw();}
on('fit',fit);

/* ---------- Pointer input: 1 finger select/drag, 2 fingers pinch+pan ---------- */
const P=new Map();let drag=null,pinch=null,moved=false,lastTap={t:0,key:''};
const pt=e=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
const status=p=>{const[x,y]=s2w(p.x,p.y);$('#coord').textContent=`x ${x.toFixed(0)}  y ${y.toFixed(0)}`;};
cv.addEventListener('pointerdown',e=>{if(cfg.mode)return;cv.focus({preventScroll:true});cv.setPointerCapture(e.pointerId);const p=pt(e);P.set(e.pointerId,p);moved=false;
 if(P.size===2){drag=null;const[a,b]=[...P.values()],[wx,wy]=s2w((a.x+b.x)/2,(a.y+b.y)/2);pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,z:view.z,wx,wy};return;}
 if(P.size>2)return;
 if(e.button===1||e.altKey){drag={m:'pan',sx:p.x,sy:p.y,vx:view.x,vy:view.y};return;}
 const c=cur();
 if(c&&!flags.lock.has(c.key)&&!flags.hid.has(c.key)){const r=rect(bounds(c)),[hx,hy]=w2s(r.x+r.w,r.y+r.h);
  if(Math.abs(p.x-hx)<=HS()&&Math.abs(p.y-hy)<=HS()){drag={m:'scale',o:c.o,s0:sc(c.o),ax:c.k==='c'?r.x+r.w/2:r.x,w0:r.x+r.w};return;}}
 const it=hit(p.x,p.y);
 if(it){pick(it);const pos=it.o.position||(it.o.position=[0,0]);drag={m:'move',o:it.o,sx:p.x,sy:p.y,ox:pos[0],oy:pos[1],key:it.key};}
 else{if(sel){sel=null;renderList();renderInsp();}drag={m:'pan',sx:p.x,sy:p.y,vx:view.x,vy:view.y};draw();}});
cv.addEventListener('pointermove',e=>{const p=pt(e);status(p);if(!P.has(e.pointerId))return;P.set(e.pointerId,p);
 if(pinch&&P.size===2){const[a,b]=[...P.values()];view.z=clamp(pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/pinch.d,.05,8);
  view.x=pinch.wx-((a.x+b.x)/2-VW/2)/view.z;view.y=pinch.wy-((a.y+b.y)/2-VH/2)/view.z;draw();return;}
 if(!drag)return;const dx=p.x-drag.sx,dy=p.y-drag.sy;
 if(drag.m==='pan'){view.x=drag.vx-dx/view.z;view.y=drag.vy-dy/view.z;}
 else if(drag.m==='move'){if(!moved&&Math.hypot(dx,dy)<4)return;moved=true;const pos=drag.o.position;pos[0]=sn(drag.ox+dx/view.z);pos[1]=sn(drag.oy+dy/view.z);}
 else{const wx=s2w(p.x,p.y)[0],k=Math.max(.02,(wx-drag.ax)/((drag.w0-drag.ax)||1));drag.o.scale=drag.s0.map(v=>Math.round(v*k*1000)/1000);}
 draw();});
const up=e=>{P.delete(e.pointerId);if(P.size<2)pinch=null;
 if(P.size===0&&drag){const d=drag;drag=null;
  if(d.m==='move'){if(moved)commit();else{const n=performance.now();if(lastTap.key===d.key&&n-lastTap.t<320){openR();tab('vis');}lastTap={t:n,key:d.key};}}
  else if(d.m==='scale')commit();}};
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{if(cfg.mode)return;e.preventDefault();zoomAt(pt(e),Math.exp(-e.deltaY*.0015));},{passive:false});
cv.addEventListener('contextmenu',e=>e.preventDefault());

/* ---------- Preview (camera bump + Web Audio metronome) ---------- */
function tick(){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime;o.frequency.value=880;g.gain.setValueAtTime(.08,t);g.gain.exponentialRampToValueAtTime(.0001,t+.06);o.connect(g).connect(ac.destination);o.start();o.stop(t+.07);}
function danceStep(now){const beat=(now-playT0)/600;for(const{key:k,o}of animTargets()){const de=+o.danceEvery;if(!(de>0))continue;const i=Math.floor(beat/de);if(danceIdx.get(k)!==i){danceIdx.set(k,i);animStart.set(k,now);}}}
function play(){if(cfg.mode)return;try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();ac.resume&&ac.resume();}catch{ac=null;toast('Audio unavailable; preview runs silently',1);}
 cfg.mode=true;bump=0;playT0=performance.now();animT0=playT0;animStart.clear();danceIdx.clear();$('#play').disabled=true;$('#stop').disabled=false;let last=performance.now(),acc=1e9;
 const loop=t=>{if(!cfg.mode)return;const dt=t-last;last=t;acc+=dt;if(acc>=600){acc=0;bump=.035;tick();}bump*=Math.exp(-dt/140);danceStep(t);paint();raf=requestAnimationFrame(loop);};raf=requestAnimationFrame(loop);}
function stop(){cfg.mode=false;cancelAnimationFrame(raf);animT0=performance.now();animStart.clear();$('#play').disabled=false;$('#stop').disabled=true;draw();}
on('play',play);on('stop',stop);

/* ---------- Fullscreen + mobile landscape gate ---------- */
const mob=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<1000);
let gateOk=!mob,gnote='';
function checkGate(){const g=$('#gate');if(!mob){g.hidden=true;$('#app').inert=false;return;}const land=innerWidth>innerHeight;g.hidden=gateOk&&land;$('#app').inert=!g.hidden;
 $('#gnote').textContent=g.hidden?'':gateOk?gnote+' Rotate your device to landscape manually to continue.':'';}
async function enterFs(){const d=document.documentElement,f=d.requestFullscreen||d.webkitRequestFullscreen;let fs=false,lk=false;
 try{if(f){await f.call(d);fs=true;}}catch{}
 try{if(screen.orientation&&screen.orientation.lock){await screen.orientation.lock('landscape');lk=true;}}catch{}
 gateOk=true;gnote=(fs?'Fullscreen active.':'Fullscreen is not available in this browser.')+(lk?'':' This browser did not allow locking the orientation.');
 checkGate();if($('#gate').hidden&&!lk)toast(gnote,1);}
async function toggleFs(){const d=document.documentElement,inFs=document.fullscreenElement||document.webkitFullscreenElement;
 try{if(inFs){await(document.exitFullscreen||document.webkitExitFullscreen).call(document);if(screen.orientation&&screen.orientation.unlock)screen.orientation.unlock();}
  else{const f=d.requestFullscreen||d.webkitRequestFullscreen;if(!f)return toast('Fullscreen is not supported in this browser',1);await f.call(d);}}
 catch(e){toast('Fullscreen failed: '+e.message,1);}}
$('#gbtn').onclick=enterFs;on('fs',toggleFs);addEventListener('resize',checkGate);addEventListener('orientationchange',checkGate);

/* ---------- Keyboard ---------- */
addEventListener('keydown',e=>{const t=e.target;if(t.closest&&t.closest('input,textarea,select,[contenteditable]'))return;
 const k=e.key.toLowerCase(),c=e.ctrlKey||e.metaKey;if(t.closest&&t.closest('button')&&(k===' '||k==='enter'))return;
 if(c){if(k==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if(k==='y'){e.preventDefault();redo();}
  else if(k==='d'){e.preventDefault();const o=cur();if(o)dup(o);}else if(k==='s'){e.preventDefault();save(true);}return;}
 if($('#dlg').open)return;
 if(k==='delete'){const o=cur();if(o){e.preventDefault();del(o);}}
 else if(k==='g'){cfg.grid=!cfg.grid;$('#grid').checked=cfg.grid;draw();}
 else if(k==='f')toggleFs();
 else if(k===' '){e.preventDefault();cfg.mode?stop():play();}
 else if(k==='escape'){if(cfg.mode)stop();else{sel=null;renderList();renderInsp();draw();}}
 else{const m={arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0],arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1]}[k];if(m){e.preventDefault();nudge(m[0],m[1],e.shiftKey);}}});

/* ---------- Status bar ---------- */
function syncCfgUI(){const s=$('#snap');if(![...s.options].some(o=>o.value==cfg.snap))s.insertBefore(el('option',{value:cfg.snap,textContent:cfg.snap+' px'}),s.lastElementChild);s.value=cfg.snap;$('#grid').checked=cfg.grid;$('#anim').checked=cfg.anim!==false;}
$('#snap').onchange=e=>{if(e.target.value==='c'){const v=parseFloat(prompt('Custom snap size (px)',cfg.snap));if(v>0)cfg.snap=v;}else cfg.snap=+e.target.value;syncCfgUI();draw();dirty();};
$('#grid').onchange=e=>{cfg.grid=e.target.checked;draw();};
$('#anim').onchange=e=>{cfg.anim=e.target.checked;if(cfg.anim)restartAnim();draw();dirty();};

/* ---------- Boot ---------- */
new ResizeObserver(resize).observe(vp);
(async()=>{syncCfgUI();syncSaveTip();if(innerWidth<=900)$('#app').classList.add('hl','hr');checkGate();resize();
 if(!(await loadProject(true))){renderAssets();sync();fit();markClean();}
 if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});})();
