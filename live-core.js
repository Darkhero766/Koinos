/* KOINOS — live civic layer: OpenStreetMap + PostgreSQL-backed civic data. */
(() => {
  // Static HTML is served by Render, so a VITE_* variable is not injected at runtime.
  // Keep the public API origin explicit here; secrets remain server-side only.
  const API = window.KOINOS_API_BASE || 'https://koinos-api-5v03.onrender.com';
  const $ = (s, r = document) => r.querySelector(s);
  const escapeHtml = value => String(value ?? '').replace(/[&<>\'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;',"\"":'&quot;'}[c]));
  const getDeviceId = () => { const key='koinos-device-id'; let id=localStorage.getItem(key); if(!id){id=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;localStorage.setItem(key,id);} return id; };
  const getPosition = () => new Promise(resolve => {
    if (!navigator.geolocation) return resolve({lat:12.9716,lng:77.5946,accuracy:null,source:'fallback'});
    navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,source:'gps'}),()=>resolve({lat:12.9716,lng:77.5946,accuracy:null,source:'fallback'}),{enableHighAccuracy:true,timeout:7000,maximumAge:60000});
  });
  async function reverseGeocode(position){
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.lat}&lon=${position.lng}&zoom=18&addressdetails=1`,{headers:{Accept:'application/json','Accept-Language':'en'}});
      if(!r.ok)return position.source==='gps'?'Your location':'Bengaluru';
      const x=await r.json(),a=x.address||{};
      return [a.road||a.pedestrian||a.neighbourhood,a.suburb||a.city_district,a.city||a.town||a.village].filter(Boolean).slice(0,3).join(', ') || x.display_name?.split(',').slice(0,3).join(', ') || 'Nearby';
    }catch{return position.source==='gps'?'Your location':'Bengaluru';}
  }
  const loadLeaflet=()=>new Promise((resolve,reject)=>{
    if(window.L)return resolve(window.L);
    if(!document.querySelector('[data-koinos-leaflet-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.dataset.koinosLeafletCss='true';document.head.appendChild(css);}
    const old=document.querySelector('[data-koinos-leaflet-js]');if(old){old.addEventListener('load',()=>resolve(window.L));old.addEventListener('error',reject);return;}
    const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.defer=true;script.dataset.koinosLeafletJs='true';script.onload=()=>resolve(window.L);script.onerror=reject;document.head.appendChild(script);
  });
  const icon=(L,s='low')=>L.divIcon({className:'koinos-live-marker',html:`<span data-severity=\"${escapeHtml(s)}\"></span>`,iconSize:[28,28],iconAnchor:[14,14]});
  const demoIssues=[
    {id:'demo-1',title:'Large pothole',category:'roads',locationLabel:'MG Road, Bengaluru',latitude:12.9755,longitude:77.6010,severity:'high',priority:89,upvotes:47,status:'reported'},
    {id:'demo-2',title:'Water leak',category:'water',locationLabel:'12th Main, Bengaluru',latitude:12.9682,longitude:77.5908,severity:'high',priority:87,upvotes:18,status:'in_progress'},
    {id:'demo-3',title:'Overflowing waste',category:'waste',locationLabel:'100 Ft Road, Bengaluru',latitude:12.9790,longitude:77.5885,severity:'medium',priority:76,upvotes:32,status:'reported'}
  ];
  async function loadIssues(position){
    try{const r=await fetch(`${API}/api/issues?lat=${position.lat}&lng=${position.lng}&radiusKm=12`,{headers:{Accept:'application/json'}});if(!r.ok)throw Error();const issues=await r.json();return issues.length?issues:demoIssues;}catch{return demoIssues;}
  }
  async function initRealMap(){
    const el=$('#big-map');if(!el)return;
    try{
      const L=await loadLeaflet();el.innerHTML='';el.classList.add('koinos-real-map');
      const position=await getPosition(), map=L.map(el,{zoomControl:false,scrollWheelZoom:false}).setView([position.lat,position.lng],14);
      L.control.zoom({position:'topright'}).addTo(map);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
      L.circleMarker([position.lat,position.lng],{radius:7,color:'#22231f',weight:3,fillColor:'#d9ff2f',fillOpacity:1}).addTo(map).bindPopup('You are here');
      const issues=await loadIssues(position),markers=[];
      issues.forEach(issue=>{if(!Number.isFinite(Number(issue.latitude))||!Number.isFinite(Number(issue.longitude)))return;const marker=L.marker([Number(issue.latitude),Number(issue.longitude)],{icon:icon(L,issue.severity||'low')}).addTo(map);marker.bindPopup(`<strong>${escapeHtml(issue.title||'Civic issue')}</strong><br>${escapeHtml(issue.locationLabel||'Nearby')}<br><b>${issue.upvotes||0}</b> people affected`);marker.on('click',()=>window.dispatchEvent(new CustomEvent('koinos:issue',{detail:issue})));marker.__issue=issue;markers.push(marker);});
      window.KOINOS_MAP={map,markers,issues,position};
      const loc=$('[data-koinos-location]');if(loc)loc.textContent=position.source==='gps'?'Using your location':'Showing Bengaluru';
      setTimeout(()=>map.invalidateSize(),100);
    }catch(e){console.warn('KOINOS map fallback',e);}
  }
  const fileToDataUrl=file=>new Promise(resolve=>{if(!file||!file.type.startsWith('image/')||file.size>4*1024*1024)return resolve(null);const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>resolve(null);reader.readAsDataURL(file);});
  function setupPhotoUpload(){
    const photo=$('#photo-upload');
    if(!photo)return;
    photo.accept='image/*';
    photo.setAttribute('capture','environment');
    const label=document.querySelector('label[for="photo-upload"]');
    // Some mobile browsers are unreliable with labels pointing at hidden file inputs.
    // Use an explicit click handler as a reliable fallback.
    label?.addEventListener('click',e=>{e.preventDefault();photo.click();});
    photo.addEventListener('change',e=>{
      const file=e.target.files?.[0];
      if(!file)return;
      if(!file.type.startsWith('image/')){photo.value='';return;}
      if(file.size>4*1024*1024){window.dispatchEvent(new CustomEvent('koinos:error',{detail:{message:'Photo is too large. Please choose an image under 4 MB.'}}));photo.value='';return;}
      const name=$('#file-name');if(name)name.textContent=file.name;
      const take=$('#take-photo');if(take)take.textContent='Change photo';
      let preview=$('#photo-preview');
      if(!preview){preview=document.createElement('img');preview.id='photo-preview';preview.alt='Selected issue photo';preview.loading='lazy';preview.style.cssText='display:block;width:100%;max-height:220px;object-fit:cover;border-radius:18px;margin:14px 0 0;';photo.parentElement?.appendChild(preview);}
      const reader=new FileReader();reader.onload=()=>{preview.src=reader.result;preview.hidden=false;};reader.readAsDataURL(file);
    });
  }
  async function submitReport(){
    const description=$('#report-description')?.value?.trim()||'';if(!description)return null;
    const position=await getPosition(),locationLabel=await reverseGeocode(position),file=$('#photo-upload')?.files?.[0],photoUrl=await fileToDataUrl(file);
    const payload={title:description.slice(0,70),description,category:$('#report-category')?.value||'other',latitude:position.lat,longitude:position.lng,locationLabel,anonymous:Boolean($('#anonymous-toggle')?.checked),photoUrl};
    try{
      const r=await fetch(`${API}/api/issues`,{method:'POST',headers:{'Content-Type':'application/json','X-Device-ID':getDeviceId()},body:JSON.stringify(payload)});
      const body=await r.json().catch(()=>({}));if(!r.ok)throw Error(body.error||`HTTP ${r.status}`);
      window.dispatchEvent(new CustomEvent('koinos:created',{detail:{...body,photoName:file?.name||null}}));return body;
    }catch(e){window.dispatchEvent(new CustomEvent('koinos:error',{detail:e}));console.warn('KOINOS report save failed',e);return null;}
  }
  async function upvote(issueId){if(!issueId||String(issueId).startsWith('demo-'))return null;try{const r=await fetch(`${API}/api/issues/${encodeURIComponent(issueId)}/upvote`,{method:'POST',headers:{'X-Device-ID':getDeviceId(),Accept:'application/json'}});const body=await r.json().catch(()=>({}));return r.ok||r.status===409?body:null;}catch{return null;}}
  async function verify(issueId,verdict){if(!issueId||String(issueId).startsWith('demo-'))return null;try{const r=await fetch(`${API}/api/issues/${encodeURIComponent(issueId)}/verify`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({verdict})});return r.ok?await r.json():null;}catch{return null;}}
  function filterMap(category='all'){(window.KOINOS_MAP?.markers||[]).forEach(m=>{const match=category==='all'||m.__issue?.category===category;m.setOpacity(match?1:.15);});}
  window.KOINOS_LIVE={submitReport,upvote,verify,getPosition,reverseGeocode,initRealMap,filterMap,apiBase:API,deviceId:getDeviceId};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupPhotoUpload);else setupPhotoUpload();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initRealMap);else initRealMap();
})();
