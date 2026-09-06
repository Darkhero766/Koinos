(() => {
  const CONFIG = window.KOINOS_CONFIG || {};
  const API = (CONFIG.apiCandidates || [window.KOINOS_API_BASE, 'https://koinos-api-5v03.onrender.com', 'https://koinos-api.onrender.com'].filter(Boolean))[0];
  const KARTA = 'https://api.openstreetcam.org/2.0/photo/';
  const esc = x => String(x ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;' }[c]));
  const center = [28.6139, 77.209]; let map, markers = [], all = [];
  const $ = s => document.querySelector(s);

  // Clearly labelled public Delhi case references. These are demo/reference records,
  // never presented as live KOINOS user reports.
  const DEMO = [
    {id:'public-2026-sonia-vihar',title:'Waterlogged & damaged road',category:'water',severity:'high',status:'reported',priority:91,upvotes:63,latitude:28.7117,longitude:77.2452,locationLabel:'Sonia Vihar · Main 25-Foot Road',createdAt:'2026-08-26',demo:true,sourceLabel:'Public case · Aug 2026',sourceUrl:'https://timesofindia.indiatimes.com/city/delhi/delhi-schoolchildren-struggle-through-waterlogged-broken-roads/articleshow/133531416.cms',referencePhotoUrl:'https://images.hindustantimes.com/rf/image_size_640x362/HT/p2/2016/08/31/Pictures/rain_d16e2974-6f48-11e6-a062-3948ff2071e9.jpg',referencePhotoCredit:'Delhi waterlogging reference · Hindustan Times'},
    {id:'public-2026-chandni-chowk',title:'Repeated road digging / utility works',category:'road',severity:'medium',status:'in_progress',priority:76,upvotes:41,latitude:28.6508,longitude:77.2303,locationLabel:'Chandni Chowk · Esplanade Road',createdAt:'2026-09-04',demo:true,sourceLabel:'Public case · Sep 2026',sourceUrl:'https://indianexpress.com/article/cities/delhi/eye-on-curbing-repeated-road-digging-delhi-plans-multi-utility-underground-ducts-10862364/',referencePhotoUrl:'https://swarajya.gumlet.io/swarajya/2025-11-08/e0oagg2y/G4wpDy7W4AAjx3-1.jpeg?compress=true&format=auto&q=75&w=610',referencePhotoCredit:'Chandni Chowk road-work reference · Swarajya'},
    {id:'public-2026-route-safety',title:'Potholes & street-light defects flagged',category:'streetlight',severity:'high',status:'reported',priority:88,upvotes:52,latitude:28.6242,longitude:77.2066,locationLabel:'Central Delhi · BRICS route',createdAt:'2026-09-06',demo:true,sourceLabel:'Public case · Sep 2026',sourceUrl:'https://navbharattimes.indiatimes.com/metro/delhi/development/brics-summit-route-delhi-traffic-police-ask-civic-agencies-to-fix-roads/articleshow/133804957.cms',referencePhotoUrl:'https://static.toiimg.com/thumb/msid-122031415%2Cwidth-1070%2Cheight-580%2Cimgsize-94080%2Cresizemode-6%2Coverlay-toi_sw%2Cpt-32%2Cy_pad-40/photo.jpg',referencePhotoCredit:'Delhi pothole reference · Times of India'}
  ];

  async function json(url, options={}) {
    const r=await fetch(url,{...options,cache:'no-store'}); const text=await r.text(); let body;
    try { body=JSON.parse(text); } catch { body=null; }
    if(!r.ok) throw Error(body?.error||`Request failed (${r.status})`); return body;
  }

  function marker(i) {
    const m=L.circleMarker([i.latitude,i.longitude],{radius:i.demo?10:8,weight:3,fillOpacity:.9});
    m.__issue=i;
    m.bindPopup(`<b>${esc(i.title)}</b><br>${esc(i.locationLabel||'Pinned location')}<br><span>${esc(i.status||'reported')} · priority ${i.priority??0}</span>${i.demo?'<br><small>Public case reference · demo data</small>':''}`);
    m.on('click',()=>show([i])); return m;
  }
  function ordered(items){return [...items].sort((a,b)=>Number(Boolean(b.demo))-Number(Boolean(a.demo))||Number(b.priority||0)-Number(a.priority||0));}
  function show(items){
    const box=$('#issue-list'),visible=ordered(items);
    if(!visible.length){box.innerHTML='<div class="notice">No reports match this filter yet. Be the first to report one.</div>';return;}
    box.innerHTML=visible.slice(0,12).map(i=>`<article class="issue ${i.demo?'demo-issue':''}" data-id="${esc(i.id)}"><div class="issue-top"><span class="tag ${i.severity==='high'?'tag-high':i.severity==='medium'?'tag-medium':'tag-low'}">${esc(i.severity||'low')} · ${esc(i.status||'reported')}</span><span class="mono">${Number(i.priority||0)}/100</span></div><h3>${esc(i.title||'Civic issue')}</h3><div class="muted">${esc(i.locationLabel||'Pinned location')}</div><div class="mono" style="margin-top:10px">${Number(i.upvotes||0)} supporters · ${i.createdAt?new Date(i.createdAt).toLocaleDateString('en-IN'):''}</div>${i.photoUrl?`<img class="issue-img" src="${esc(i.photoUrl)}" alt="Community photo for ${esc(i.title)}" loading="lazy">`:i.referencePhotoUrl?`<img class="issue-img" src="${esc(i.referencePhotoUrl)}" alt="Reference photo related to ${esc(i.title)}" loading="lazy"><div class="mono muted" style="margin-top:7px">${esc(i.referencePhotoCredit||'Public reference image')} · reference image, not an exact case photo</div>`:''}${i.demo?`<div class="case-source"><span>${esc(i.sourceLabel||'Public case reference')}</span><a href="${esc(i.sourceUrl)}" target="_blank" rel="noopener noreferrer">Case source ↗</a></div>`:''}</article>`).join('');
    box.querySelectorAll('.issue').forEach(el=>el.onclick=e=>{if(e.target.closest('a'))return;const i=all.find(x=>String(x.id)===el.dataset.id);if(i&&Number.isFinite(Number(i.latitude)))map.setView([i.latitude,i.longitude],17);});
  }

  async function loadIssues(){
    let live=[];
    // Primary source is Supabase so Live issues remains useful even when the
    // optional Render API is asleep or unavailable.
    try {
      if (window.KOINOS_DB?.listIssues) live = await window.KOINOS_DB.listIssues({lat:center[0],lng:center[1],radiusKm:30});
    } catch (e) { console.warn('KOINOS Supabase live issues unavailable:', e); }
    if (!live.length && API) {
      try {
        const data=await json(`${API}/api/issues?lat=${center[0]}&lng=${center[1]}&radiusKm=30`);
        live=Array.isArray(data)?data:(Array.isArray(data?.issues)?data.issues:[]);
      } catch(e) { console.warn('KOINOS API unavailable:',e); }
    }
    const byId=new Map(live.map(x=>[String(x.id),x]));
    DEMO.forEach(x=>{if(!byId.has(String(x.id)))byId.set(String(x.id),{...x});});
    all=[...byId.values()];
    renderLive(live.length?'Delhi · live KOINOS + public demo cases':'Delhi · public demo cases · ready for live reports');
  }

  function renderLive(status){markers.forEach(m=>m.remove());markers=ordered(all).filter(i=>Number.isFinite(Number(i.latitude))&&Number.isFinite(Number(i.longitude))).map(marker);markers.forEach(m=>m.addTo(map));show(all);$('#updated').textContent=new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});$('#map-status').textContent=status;}
  function pickImage(x){return x?.fileUrl||x?.fileurlProc||x?.fileurlLTh||x?.fileurlTh||x?.image||x?.url||x?.file_url||null;}
  function pickDate(x){return x?.shotDate||x?.dateAdded||x?.date_added||x?.capturedAt||'Capture date unavailable';}
  async function directStreetImagery(){const url=`${KARTA}?lat=${center[0]}&lng=${center[1]}&radius=12000&zoomLevel=12&join=sequence&orderBy=id&orderDirection=desc`;const b=await json(url);const rows=b?.result?.data||b?.data||[];return rows.map(x=>({image:pickImage(x),capturedAt:pickDate(x),lat:Number(x.lat??x.latitude),lng:Number(x.lng??x.longitude),sourceUrl:x.id?`https://kartaview.org/details/${x.id}`:'https://kartaview.org/map/@28.6139,77.209,12z'})).filter(x=>x.image&&Number.isFinite(x.lat)&&Number.isFinite(x.lng)).filter(x=>x.lat>28.35&&x.lat<28.9&&x.lng>76.8&&x.lng<77.6).slice(0,6);}
  async function street(){const host=$('#street-images');try{let rows=[];try{const b=await json(`${API}/api/street-imagery?lat=${center[0]}&lng=${center[1]}&radius=12000`);rows=b.items||[];}catch{}if(!rows.length)rows=await directStreetImagery();if(!rows.length){host.innerHTML='<div class="notice">No public street-level capture is available for this Delhi area right now.</div>';return;}host.innerHTML=rows.slice(0,6).map(x=>`<article class="issue"><img class="issue-img street-photo" src="${esc(x.image)}" alt="Public street-level capture" loading="lazy"><div class="mono" style="margin-top:10px">${esc(x.capturedAt||'Capture date unavailable')}</div><div class="muted">${Number(x.lat).toFixed(4)}, ${Number(x.lng).toFixed(4)}</div><a class="btn" style="display:inline-block;margin-top:10px" target="_blank" rel="noopener noreferrer" href="${esc(x.sourceUrl||'https://kartaview.org/')}">Open KartaView ↗</a></article>`).join('');}catch(e){console.warn('Street imagery unavailable:',e);host.innerHTML='<div class="notice">Street imagery is temporarily unavailable. The civic map and public case references are still available.</div>';}}
  function apply(cat){const filtered=cat==='all'?all:all.filter(i=>(i.category||'').toLowerCase().includes(cat));show(filtered);markers.forEach(m=>{const ok=cat==='all'||m.__issue?.category===cat;m.setStyle({opacity:ok?1:.15,fillOpacity:ok?1:.15});});}
  document.addEventListener('DOMContentLoaded',async()=>{map=L.map('live-map').setView(center,12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);await loadIssues();street();document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-cat]').forEach(x=>x.classList.remove('active'));b.classList.add('active');apply(b.dataset.cat);});$('#locate').onclick=()=>navigator.geolocation?.getCurrentPosition(p=>map.setView([p.coords.latitude,p.coords.longitude],15));setInterval(loadIssues,60000);});
})();
