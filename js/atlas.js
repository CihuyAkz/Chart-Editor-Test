// Sparrow (.xml) and Packer (.txt) texture-atlas support, HaxeFlixel-compatible frame lookup.
export const atlasKind=p=>/\.xml$/i.test(p)?'sparrow':/\.txt$/i.test(p)?'packer':null;
const pad4=n=>String(Math.max(0,n|0)).padStart(4,'0');
const num=(v,d=0)=>{const n=parseFloat(v);return Number.isFinite(n)?n:d;};

// Returns {type,frames:[{name,x,y,w,h,fx,fy,fw,fh,rot}],cache:Map} or throws.
export function parseAtlas(text,type){const frames=[];
 if(type==='sparrow'){const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.querySelector('parsererror'))throw new Error('XML is not valid');
  for(const t of doc.getElementsByTagName('SubTexture')){const g=k=>t.getAttribute(k),w=num(g('width')),h=num(g('height'));
   frames.push({name:g('name')||'',x:num(g('x')),y:num(g('y')),w,h,fx:num(g('frameX')),fy:num(g('frameY')),
    fw:num(g('frameWidth'),w),fh:num(g('frameHeight'),h),rot:g('rotated')==='true'});}}
 else{for(const ln of text.split(/\r?\n/)){const m=/^\s*(.+?)\s*=\s*(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)/.exec(ln);
   if(m)frames.push({name:m[1],x:+m[2],y:+m[3],w:+m[4],h:+m[5],fx:0,fy:0,fw:+m[4],fh:+m[5],rot:false});}}
 if(!frames.length)throw new Error('No frames found in atlas');
 return{type,frames,cache:new Map()};}

// Unique animation prefixes ("bop0000" -> "bop"), in file order.
export function atlasPrefixes(at){const s=new Set();for(const f of at.frames)s.add(f.name.replace(/\d+$/,''));return[...s];}

const byTrailingNumber=(a,b)=>{const x=parseInt((/(\d+)$/.exec(a.name)||[])[1]??-1),y=parseInt((/(\d+)$/.exec(b.name)||[])[1]??-1);return x-y||(a.name<b.name?-1:1);};

// Resolves an animation entry ({prefix, frameIndices}) to a frame list, like FlxAnimation addByPrefix / addByIndices.
export function animFrames(at,an){if(!at||!an)return[];const pre=String(an.prefix??''),idx=Array.isArray(an.frameIndices)?an.frameIndices.filter(Number.isFinite):[];
 const key=pre+'|'+idx.join(',');let r=at.cache.get(key);if(r)return r;
 const all=at.frames.filter(f=>f.name.startsWith(pre)).sort(byTrailingNumber);
 if(idx.length){const map=new Map(at.frames.map(f=>[f.name,f]));
  r=idx.map(i=>map.get(pre+pad4(i))||all[i]).filter(Boolean);}
 else r=all;
 at.cache.set(key,r);return r;}
