import{DEFAULT_STAGE,newChar,normalize,validate,openContainer,buildPackage,slug}from'./stage.js';
const $=s=>document.querySelector(s);
const el=(t,a={},...k)=>{const e=document.createElement(t);for(const[x,y]of Object.entries(a))(x in e)?e[x]=y:e.setAttribute(x,y);e.append(...k);return e;};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const mime=p=>({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'})[String(p).split('.').pop().toLowerCase()]||'application/octet-stream';
let stage=DEFAULT_STAGE(),container=null,sel=null,curAsset=null,dirtyT=0,mvT=0,tt=0,VW=0,VH=0,dpr=1,pend=0,ac=null,bump=0,raf=0,pv=0;
const view={x:640,y:400,z:.5};let V=view;
const assets=[],flags={hid:new Set(),lock:new Set()},cfg={snap:10,grid:true,cam:true,camX:640,camY:360,mode:false};
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
function findAsset(p){const l=String(p||'').toLowerCase(),b=l.split('/').pop();
 return assets.find(a=>a.path.toLowerCase().replace(/^images\//,'').replace(/\.\w+$/,'')===l)||assets.find(a=>a.base.toLowerCase()===b);}
function bounds(it){const o=it.o,[x,y]=o.position||[0,0],[sx,sy]=sc(o);
 if(it.k==='c')return{x:x-150*sx,y:y-400*sy,w:300*sx,h:400*sy};
 const a=findAsset(o.assetPath);return{x,y,w:(a?a.w:200)*sx,h:(a?a.h:200)*sy,a};}
const rect=b=>({x:Math.min(b.x,b.x+b.w),y:Math.min(b.y,b.y+b.h),w:Math.abs(b.w),h:Math.abs(b.h)});
const uniq=n=>{const b=n;let c=1;while(stage.props.some(p=>p&&p.name===n))n=b+(++c);return n;};

/* ---------- History ---------- */
function commit(keep){const s=JSON.stringify(stage);if(s===Hs.last)return;Hs.u.push(Hs.last);if(Hs.u.length>200)Hs.u.shift();Hs.r=[];Hs.last=s;sync(!keep);}
function restore(s){stage=JSON.parse(s);Hs.last=s;if(sel&&!cur())sel=null;sync();}
const undo=()=>{if(Hs.u.length){Hs.r.push(Hs.last);restore(Hs.u.pop());}};
const redo=()=>{if(Hs.r.length){Hs.u.push(Hs.last);restore(Hs.r.pop());}};
function resetHist(){Hs.u=[];Hs.r=[];Hs.last=JSON.stringify(stage);flags.hid.clear();flags.lock.clear();sel=null;}
function sync(insp=true){renderList();if(insp)renderInsp();jsonSync();$('#undo').disabled=!Hs.u.length;$('#redo').disabled=!Hs.r.length;draw();dirty();}
const live=()=>{draw();jsonSync();dirty();};

/* ---------- Storage (IndexedDB autosave) ---------- */
const idb=(m,f)=>new Promise((res,rej)=>{if(!window.indexedDB)return rej(new Error('IndexedDB unavailable'));const r=indexedDB.open('fnfse',1);
 r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onerror=()=>rej(r.error);
 r.onsuccess=()=>{const t=r.result.transaction('kv',m),q=f(t.objectStore('kv'));t.oncomplete=()=>{res(q.result);r.result.close();};t.onerror=()=>rej(t.error);};});
function dirty(){const s=$('#save');s.textContent='Unsaved Changes';s.className='warn';clearTimeout(dirtyT);dirtyT=setTimeout(()=>save(),800);}
async function save(manual){try{await idb('readwrite',s=>s.put({stage:JSON.stringify(stage),assets:assets.map(({name,path,blob})=>({name,path,blob})),container,cfg:{snap:cfg.snap,grid:cfg.grid,camX:cfg.camX,camY:cfg.camY}},'project'));
 $('#save').textContent='Saved';$('#save').className='ok';if(manual)toast('Project saved locally in this browser');}
 catch(e){$('#save').textContent='Save failed';toast('Cannot save to IndexedDB: '+e.message,1);}}
async function loadProject(silent){let d;try{d=await idb('readonly',s=>s.get('project'));}catch(e){if(!silent)toast(e.message,1);return false;}
 if(!d){if(!silent)toast('No saved project found',1);return false;}
 try{const s=normalize(JSON.parse(d.stage)),er=validate(s);if(er.length)throw new Error(er[0]);
  clearAssets();for(const a of d.assets||[])await addImage(a.name,a.path,a.blob);
  stage=s;container=d.container||null;Object.assign(cfg,d.cfg||{});resetHist();syncCfgUI();renderAssets();sync();$('#save').textContent='Saved';$('#save').className='ok';fit();return true;}
 catch(e){toast('Saved project is unreadable: '+e.message,1);return false;}}

/* ---------- Assets ---------- */
function clearAssets(){assets.forEach(a=>URL.revokeObjectURL(a.url));assets.length=0;curAsset=null;}
async function addImage(name,path,blob){const url=URL.createObjectURL(blob),img=new Image();img.src=url;
 try{await img.decode();}catch{URL.revokeObjectURL(url);toast('Could not read image: '+name,1);return null;}
 const o=assets.findIndex(a=>a.path===path);if(o>=0){URL.revokeObjectURL(assets[o].url);assets.splice(o,1);}
 const a={name,base:name.replace(/\.\w+$/,''),path,blob,img,url,w:img.naturalWidth||100,h:img.naturalHeight||100};assets.push(a);return a;}
async function uploadImages(fs){for(const f of fs)await addImage(f.name,`images/stages/${slug(stage.name)}/${f.name}`,f);renderAssets();draw();dirty();}
function rmAsset(a){URL.revokeObjectURL(a.url);assets.splice(assets.indexOf(a),1);if(curAsset===a)curAsset=null;renderAssets();draw();dirty();}
function renderAssets(){const L=$('#alist');L.replaceChildren();
 if(!assets.length)L.append(el('p',{className:'hint'},'No assets yet. Upload PNG, JPG, WEBP or SVG. Files stay in your browser.'));
 for(const a of assets){const c=el('div',{className:'asset'+(a===curAsset?' on':''),draggable:true,tabIndex:0,role:'option'},el('img',{src:a.url,alt:''}),
  el('span',{},a.name+' ',el('small',{},`${a.w}×${a.h}`)),el('button',{className:'ib',textContent:'✕',title:'Remove asset','aria-label':'Remove asset '+a.name,onclick:e=>{e.stopPropagation();rmAsset(a);}}));
  c.ondragstart=e=>e.dataTransfer.setData('text/plain',a.path);c.onclick=()=>{curAsset=a;renderAssets();};c.ondblclick=()=>addProp(a);
  c.onkeydown=e=>{if(e.key==='Enter')addProp(a);};L.append(c);}}

/* ---------- Object operations ---------- */
function addProp(a,x,y){const z=Math.max(0,...stage.props.map(p=>+p.zIndex||0))+10;
 stage.props.push({name:uniq(a.base),assetPath:a.path.replace(/^images\//,'').replace(/\.\w+$/,''),zIndex:z,position:[sn(x??view.x-a.w/2),sn(y??view.y-a.h/2)],scale:[1,1],scroll:[1,1],isPixel:false});
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
const ib=(t,l,f)=>el('button',{className:'ib',textContent:t,title:l,'aria-label':l,onclick:e=>{e.stopPropagation();f();}});
function renderList(){const L=$('#list');L.replaceChildren();
 for(const it of objs().reverse()){const s=same(it),nm=it.k==='p'?(it.o.name||'(unnamed)'):it.id.toUpperCase();
  const row=el('div',{className:'row'+(s?' on':''),tabIndex:0,role:'option','aria-selected':String(s),onclick:()=>pick(it),onkeydown:e=>{if(e.key==='Enter')pick(it);}});
  row.append(el('div',{className:'top'},el('span',{className:'nm'},(it.k==='c'?'◆ ':'▣ ')+nm),el('small',{},'z'+(+it.o.zIndex||0)),
   ib(flags.hid.has(it.key)?'○':'●','Show / hide',()=>tog('hid',it)),ib(flags.lock.has(it.key)?'🔒':'🔓','Lock / unlock',()=>tog('lock',it))));
  if(s)row.append(el('div',{className:'top'},ib('▲','Z-index +10',()=>zmove(it,10)),ib('▼','Z-index −10',()=>zmove(it,-10)),ib('⧉','Duplicate',()=>dup(it)),ib('✎','Rename',()=>ren(it)),ib('✕','Delete',()=>del(it))));
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
function renderInsp(){const I=$('#insp');I.replaceChildren();
 I.append(el('h3',{},'Stage'),tf('Name',stage,'name'),nf('Camera zoom',stage,'cameraZoom',1,{step:.01,range:[.2,3]}),cfgf('Cam X','camX'),cfgf('Cam Y','camY'),
  fld('Camera preview',el('input',{type:'checkbox',checked:cfg.cam,'aria-label':'Camera preview',onchange:e=>{cfg.cam=e.target.checked;draw();}}),
   el('button',{textContent:'Reset camera',onclick:()=>{cfg.camX=640;cfg.camY=360;stage.cameraZoom=1;commit();}})),
  el('p',{className:'hint'},'Camera X/Y only positions the preview frame; the Stage JSON stores just cameraZoom.'));
 const c=cur();if(!c){I.append(el('p',{className:'hint'},'Select an object in the viewport or list to edit it.'));return;}
 const o=c.o;I.append(el('h3',{},c.k==='p'?'Prop':'Character: '+c.id.toUpperCase()));
 if(c.k==='p')I.append(tf('Name',o,'name',true),tf('Asset path',o,'assetPath'));
 I.append(pf('Position',o,'position',[0,0]),pf('Scale',o,'scale',[1,1],{step:.01,uni:[.05,5]}));
 if(c.k==='p')I.append(pf('Scroll',o,'scroll',[1,1],{step:.01,uni:[0,2]}));else I.append(pf('Camera offsets',o,'cameraOffsets',[0,0]));
 I.append(nf('Z index',o,'zIndex',0,{range:[-100,500]}));
 if(c.k==='p')I.append(fld('Pixel mode',el('input',{type:'checkbox',checked:!!o.isPixel,'aria-label':'Pixel mode',onchange:e=>{o.isPixel=e.target.checked;commit(true);}})));
 const known=['name','assetPath','position','scale','scroll','zIndex','isPixel','cameraOffsets'],ex=Object.keys(o).filter(k=>!known.includes(k));
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

/* ---------- Files ---------- */
async function openFile(f){let c;try{c=await openContainer(await f.arrayBuffer());}catch(e){toast(e.message,1);return;}
 const s=normalize(c.stage),er=validate(s);if(er.length){toast('Invalid stage: '+er[0]+(er.length>1?` (+${er.length-1} more)`:''),1);return;}
 clearAssets();container=c.entries.length?{jsonPath:c.jsonPath,extra:c.extra,ext:(f.name.match(/\.(\w+)$/)||[])[1]||'zip'}:null;
 for(const im of c.images)await addImage(im.path.split('/').pop(),im.path,new Blob([im.data],{type:mime(im.path)}));
 stage=s;resetHist();renderAssets();sync();fit();
 if(c.entries.length)modal('Container: '+f.name,el('p',{},`${c.entries.length} files found. Stage JSON in use: ${c.jsonPath}`),
  el('ul',{className:'tree'},...c.entries.map(e=>el('li',{className:e.path===c.jsonPath?'hit':''},`${e.path} (${e.kind}, ${e.size} B)`))));
 else toast('Stage loaded');}
async function handleFiles(fs){const imgs=[];for(const f of fs){if(/\.(fnfs|zip|json)$/i.test(f.name))await openFile(f);
 else if(/^image\//.test(f.type)||/\.(png|jpe?g|webp|svg)$/i.test(f.name))imgs.push(f);else toast('Unsupported file: '+f.name,1);}
 if(imgs.length){await uploadImages(imgs);tab('ast');}}
$('#file').onchange=async e=>{const fs=[...e.target.files];e.target.value='';if(fs.length)await handleFiles(fs);};
const okExport=()=>{const er=validate(stage);if(er.length){toast('Cannot export: '+er.join('; '),1);return false;}return true;};
on('export',()=>{const ext=(container&&container.ext)||'zip';
 modal('Export',el('p',{},'JSON is validated before export. Unknown fields are kept. The package is a ZIP with the Stage JSON plus your assets.'),
  el('button',{className:'pri',textContent:'Export Stage JSON',onclick:()=>{if(okExport())dl(new Blob([JSON.stringify(stage,null,2)],{type:'application/json'}),slug(stage.name)+'.json');}}),
  el('button',{textContent:'Export Package (.'+ext+')',onclick:async()=>{if(!okExport())return;try{dl(await buildPackage(stage,assets,container),slug(stage.name)+'.'+ext);}catch(e){toast('Package failed: '+e.message,1);}}}));});
on('new',()=>{if(!confirm('Start a new stage? Unexported changes in the editor will be lost.'))return;clearAssets();stage=DEFAULT_STAGE();container=null;resetHist();renderAssets();sync();fit();});
on('open',()=>$('#file').click());on('upl',()=>$('#file').click());on('save',()=>save(true));on('undo',undo);on('redo',redo);
on('addp',()=>{if(curAsset)addProp(curAsset);else{openR();tab('ast');toast(assets.length?'Select an asset, then tap Add to stage':'Upload an image asset first');if(!assets.length)$('#file').click();}});
on('addsel',()=>curAsset?addProp(curAsset):toast('Select an asset first',1));on('addc',addChar);
on('tl',()=>$('#app').classList.toggle('hl'));on('tr',()=>$('#app').classList.toggle('hr'));
on('set',()=>modal('Settings',el('button',{textContent:'Save project (local)',onclick:()=>save(true)}),
 el('button',{textContent:'Load saved project',onclick:async()=>{if(await loadProject(false))toast('Project loaded');}}),
 el('button',{textContent:'Clear local project',onclick:async()=>{if(!confirm('Delete the project saved in this browser?'))return;try{await idb('readwrite',s=>s.delete('project'));toast('Local project cleared');}catch(e){toast(e.message,1);}}}),
 el('p',{className:'hint'},'Everything runs locally; nothing is uploaded. Touch: drag to move, drag the pink corner to scale, drag empty space to pan, pinch to zoom, double-tap an object to open Inspector. Desktop: WASD/arrows (Shift = faster), Ctrl+Z/Y, Ctrl+D, Delete, G grid, F fullscreen, Space preview, Alt+drag or middle mouse to pan.')));
vp.ondragover=e=>e.preventDefault();
vp.ondrop=async e=>{e.preventDefault();const r=cv.getBoundingClientRect(),[x,y]=s2w(e.clientX-r.left,e.clientY-r.top),a=assets.find(a=>a.path===e.dataTransfer.getData('text/plain'));
 if(a)return addProp(a,x,y);if(e.dataTransfer.files.length)await handleFiles([...e.dataTransfer.files]);};

/* ---------- Viewport ---------- */
const w2s=(x,y)=>[(x-V.x)*V.z+VW/2,(y-V.y)*V.z+VH/2],s2w=(x,y)=>[(x-VW/2)/V.z+V.x,(y-VH/2)/V.z+V.y];
function resize(){const r=vp.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);VW=r.width;VH=r.height;cv.width=Math.round(VW*dpr);cv.height=Math.round(VH*dpr);draw();}
function draw(){if(!pend)pend=requestAnimationFrame(()=>{pend=0;paint();});}
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
function drawObj(it){const b=bounds(it),[sx,sy]=w2s(b.x,b.y);
 if(it.k==='p'&&b.a){cx.imageSmoothingEnabled=!it.o.isPixel;cx.drawImage(b.a.img,sx,sy,b.w*V.z,b.h*V.z);return;}
 const r=rect(b),[rx,ry]=w2s(r.x,r.y),col=it.k==='c'?({bf:'#4fa8ff',dad:'#b57bff',gf:'#ff6fae'}[it.id]||'#9aa5b1'):'#888';
 cx.fillStyle=col+'44';cx.strokeStyle=col;cx.lineWidth=2;cx.setLineDash(it.k==='p'?[6,4]:[]);cx.fillRect(rx,ry,r.w*V.z,r.h*V.z);cx.strokeRect(rx,ry,r.w*V.z,r.h*V.z);cx.setLineDash([]);
 cx.fillStyle='#fff';cx.font='600 13px sans-serif';cx.fillText(it.k==='c'?it.id.toUpperCase():'Missing asset: '+(it.o.assetPath||''),rx+6,ry+18);
 if(it.k==='c'){const[px,py]=w2s(...(it.o.position||[0,0]));cx.beginPath();cx.arc(px,py,4,0,7);cx.fill();}}
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
  if(Math.abs(p.x-hx)<=HS()&&Math.abs(p.y-hy)<=HS()){drag={m:'scale',o:c.o,s0:sc(c.o),ax:c.k==='c'?(c.o.position||[0,0])[0]:r.x,w0:r.x+r.w};return;}}
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
function play(){if(cfg.mode)return;try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();ac.resume&&ac.resume();}catch{ac=null;toast('Audio unavailable; preview runs silently',1);}
 cfg.mode=true;bump=0;$('#play').disabled=true;$('#stop').disabled=false;let last=performance.now(),acc=1e9;
 const loop=t=>{if(!cfg.mode)return;const dt=t-last;last=t;acc+=dt;if(acc>=600){acc=0;bump=.035;tick();}bump*=Math.exp(-dt/140);paint();raf=requestAnimationFrame(loop);};raf=requestAnimationFrame(loop);}
function stop(){cfg.mode=false;cancelAnimationFrame(raf);$('#play').disabled=false;$('#stop').disabled=true;draw();}
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
function syncCfgUI(){const s=$('#snap');if(![...s.options].some(o=>o.value==cfg.snap))s.insertBefore(el('option',{value:cfg.snap,textContent:cfg.snap+' px'}),s.lastElementChild);s.value=cfg.snap;$('#grid').checked=cfg.grid;}
$('#snap').onchange=e=>{if(e.target.value==='c'){const v=parseFloat(prompt('Custom snap size (px)',cfg.snap));if(v>0)cfg.snap=v;}else cfg.snap=+e.target.value;syncCfgUI();draw();dirty();};
$('#grid').onchange=e=>{cfg.grid=e.target.checked;draw();};

/* ---------- Boot ---------- */
new ResizeObserver(resize).observe(vp);
(async()=>{syncCfgUI();if(innerWidth<=900)$('#app').classList.add('hl','hr');checkGate();resize();
 if(!(await loadProject(true))){renderAssets();sync();fit();$('#save').textContent='Saved';$('#save').className='ok';clearTimeout(dirtyT);}
 if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});})();
