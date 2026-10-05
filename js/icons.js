// Custom inline SVG icon set (no emoji / system glyphs, so every device renders them identically).
const G=(()=>{const p=[];for(let i=0;i<8;i++){const a=Math.PI*2*i/8;for(const[da,r]of[[-.2,7.6],[-.12,10],[.12,10],[.2,7.6]]){const t=a+da;p.push((12+r*Math.cos(t)).toFixed(2)+' '+(12+r*Math.sin(t)).toFixed(2));}}return'M'+p.join('L')+'Z';})();
const P={
 undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
 redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
 play:'<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
 stop:'<rect x="5.5" y="5.5" width="13" height="13" rx="2" fill="currentColor"/>',
 full:'<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
 gear:`<path d="${G}"/><circle cx="12" cy="12" r="3"/>`,
 layers:'<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
 sliders:'<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
 filePlus:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 12v6M9 15h6"/>',
 folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 save:'<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3"/><path d="M7 21v-7h10v7"/>',
 export:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 eyeOff:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" opacity=".45"/><circle cx="12" cy="12" r="3" opacity=".45"/><path d="M4 4l16 16"/>',
 lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 unlock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
 up:'<path d="m6 15 6-6 6 6"/>',
 down:'<path d="m6 9 6 6 6-6"/>',
 copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
 edit:'<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
 x:'<path d="M6 6l12 12M18 6 6 18"/>',
 fit:'<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><circle cx="12" cy="12" r="2"/>',
 film:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5"/>',
 restart:'<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
 search:'<circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>',
 cube:'<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>'
};
export function ic(n,cls=''){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('class','ic '+cls);s.setAttribute('aria-hidden','true');s.innerHTML=P[n]||'';return s;}
export function hydrate(root=document){root.querySelectorAll('i[data-i]').forEach(i=>i.replaceWith(ic(i.dataset.i)));}
