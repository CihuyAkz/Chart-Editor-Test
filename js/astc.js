// ASTC (.astc) support. Decoding is done by the browser's own GPU decoder (WEBGL_compressed_texture_astc),
// then read back as plain RGBA so the 2D editor canvas can draw it. The original .astc bytes are never altered.
export const isAstc=n=>/\.astc$/i.test(n);
const BLOCKS=[[4,4],[5,4],[5,5],[6,5],[6,6],[8,5],[8,6],[8,8],[10,5],[10,6],[10,8],[10,10],[12,10],[12,12]];

export function parseAstc(u8){
 if(u8.length<16||u8[0]!==0x13||u8[1]!==0xAB||u8[2]!==0xA1||u8[3]!==0x5C)throw new Error('not a valid .astc file (bad header)');
 const[bw,bh,bz]=[u8[4],u8[5],u8[6]],le=o=>u8[o]|u8[o+1]<<8|u8[o+2]<<16,w=le(7),h=le(10),d=le(13),idx=BLOCKS.findIndex(b=>b[0]===bw&&b[1]===bh);
 if(idx<0||bz!==1||d>1)throw new Error(`unsupported ASTC block size ${bw}x${bh}x${bz} (only 2D textures are supported)`);
 if(!w||!h)throw new Error('ASTC header reports an empty image');
 const need=Math.ceil(w/bw)*Math.ceil(h/bh)*16;
 if(u8.length-16<need)throw new Error(`ASTC data is truncated (${u8.length-16} of ${need} bytes)`);
 return{w,h,bw,bh,idx,data:u8.subarray(16,16+need)};}

let G=null;
function ctx(){if(G)return G;
 const c=document.createElement('canvas'),gl=c.getContext('webgl',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true,antialias:false,depth:false,stencil:false});
 if(!gl)throw new Error('WebGL is not available, so ASTC cannot be decoded here');
 const ext=gl.getExtension('WEBGL_compressed_texture_astc')||gl.getExtension('WEBKIT_WEBGL_compressed_texture_astc');
 if(!ext)throw new Error('this browser/GPU has no ASTC support (common on desktop Windows/Linux). Open the editor on a phone or Apple device, or convert the file to PNG');
 const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error('shader: '+gl.getShaderInfoLog(o));return o;};
 const pr=gl.createProgram();
 gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}'));
 gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,'#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform sampler2D t;varying vec2 uv;void main(){gl_FragColor=texture2D(t,uv);}'));
 gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error('shader link failed');
 gl.useProgram(pr);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const l=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);
 gl.disable(gl.BLEND);gl.disable(gl.DITHER);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
 c.addEventListener('webglcontextlost',e=>{e.preventDefault();G=null;});
 return G={c,gl,ext};}

// buf: ArrayBuffer of a .astc file -> {blob (PNG), w, h, bw, bh}
export async function decodeAstc(buf){
 const info=parseAstc(new Uint8Array(buf)),{c,gl,ext}=ctx(),{w,h}=info;
 const max=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
 if(w>max||h>max)throw new Error(`image is ${w}×${h}, larger than this GPU's limit (${max})`);
 c.width=w;c.height=h;if(gl.drawingBufferWidth<w||gl.drawingBufferHeight<h)throw new Error('not enough GPU memory for a '+w+'×'+h+' texture');
 const fmt=ext.COMPRESSED_RGBA_ASTC_4x4_KHR+info.idx,tex=gl.createTexture();
 gl.bindTexture(gl.TEXTURE_2D,tex);
 for(const[k,v]of[[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
 gl.getError();gl.compressedTexImage2D(gl.TEXTURE_2D,0,fmt,w,h,0,info.data);
 if(gl.getError()!==gl.NO_ERROR){gl.deleteTexture(tex);throw new Error('the GPU rejected this ASTC texture');}
 gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 const px=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);gl.deleteTexture(tex);
 // readPixels is bottom-up, texture row 0 was drawn at the bottom, so rows are already in file order.
 const o=document.createElement('canvas');o.width=w;o.height=h;o.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer),w,h),0,0);
 const blob=await new Promise(r=>o.toBlob(r,'image/png'));if(!blob)throw new Error('could not convert decoded ASTC to an image');
 return{blob,w,h,bw:info.bw,bh:info.bh};}
