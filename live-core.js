/* KOINOS — live civic layer: OpenStreetMap + real API data. */
(() => {
  const API = window.KOINOS_API_BASE || (location.hostname === 'koinos.onrender.com' ? 'https://koinos-api.onrender.com' : '');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>\'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const getDeviceId = () => {
    const key = 'koinos-device-id';
    let id = localStorage.getItem(key);
    if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; localStorage.setItem(key, id); }
    return id;
  };
  const getPosition = () => new Promise(resolve => {
    if (!navigator.geolocation) return resolve({ lat: 12.9716, lng: 77.5946, accuracy: null });
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve({ lat: 12.9716, lng: 77.5946, accuracy: null }),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
  });

  const loadLeaflet = () => new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    if (!document.querySelector('[data-koinos-leaflet-css]')) {
      const css = document.createElement('link'); css.rel='stylesheet'; css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; css.dataset.koinosLeafletCss='true'; document.head.appendChild(css);
    }
    const old = document.querySelector('[data-koinos-leaflet-js]');
    if (old) { old.addEventListener('load', () => resolve(window.L)); old.addEventListener('error', reject); return; }
    const script = document.createElement('script'); script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.defer=true; script.dataset.koinosLeafletJs='true';
    script.onload=()=>resolve(window.L); script.onerror=reject; document.head.appendChild(script);
  });

  const icon = (L, severity) => L.divIcon({ className:'koinos-live-marker', html:`<span data-severity="${severity}"></span>`, iconSize:[28,28], iconAnchor:[14,14] });
  const demoIssues = [
    { id:'demo-1', title:'Large pothole', category:'roads', locationLabel:'MG Road, Bengaluru', latitude:12.9755, longitude:77.6010, severity:'high', priority:89, upvotes:47, status:'reported' },
    { id:'demo-2', title:'Water leak', category:'water', locationLabel:'12th Main, Bengaluru', latitude:12.9682, longitude:77.5908, severity:'high', priority:87, upvotes:18, status:'in_progress' },
    { id:'demo-3', title:'Overflowing waste', category:'waste', locationLabel:'100 Ft Road, Bengaluru', latitude:12.9790, longitude:77.5885, severity:'medium', priority:76, upvotes:32, status:'reported' }
  ];

  async function loadIssues(position) {
    if (!API) return demoIssues;
    try {
      const r = await fetch(`${API}/api/issues?lat=${position.lat}&lng=${position.lng}&radiusKm=12`, { headers:{Accept:'application/json'} });
      if (!r.ok) throw new Error('API unavailable');
      const issues = await r.json();
      return issues.length ? issues : demoIssues;
    } catch { return demoIssues; }
  }

  async function initRealMap() {
    const el = $('#big-map'); if (!el) return;
    try {
      const L = await loadLeaflet();
      el.innerHTML=''; el.classList.add('koinos-real-map');
      const map=L.map(el,{zoomControl:false,scrollWheelZoom:false}).setView([12.9716,77.5946],13);
      L.control.zoom({position:'topright'}).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
      const position=await getPosition();
      map.setView([position.lat,position.lng],14);
      L.circleMarker([position.lat,position.lng],{radius:7,color:'#22231f',weight:3,fillColor:'#d9ff2f',fillOpacity:1}).addTo(map).bindPopup('You are here');
      const issues=await loadIssues(position);
      const markers=[];
      issues.forEach(issue=>{
        if (!Number.isFinite(Number(issue.latitude)) || !Number.isFinite(Number(issue.longitude))) return;
        const marker=L.marker([Number(issue.latitude),Number(issue.longitude)],{icon:icon(L,issue.severity||'low')}).addTo(map);
        marker.bindPopup(`<strong>${escapeHtml(issue.title||'Civic issue')}</strong><br>${escapeHtml(issue.locationLabel||'Nearby')}<br><b>${issue.upvotes||0}</b> people affected`);
        marker.on('click',()=>window.dispatchEvent(new CustomEvent('koinos:issue',{detail:issue})));
        marker.__issue=issue; markers.push(marker);
      });
      window.KOINOS_MAP={map,markers,issues};
      $('[data-koinos-location]') && ($('[data-koinos-location]').textContent=position.accuracy?'Using your location':'Showing Bengaluru');
      setTimeout(()=>map.invalidateSize(),100);
    } catch(e) { console.warn('KOINOS map fallback',e); }
  }

  async function submitReport() {
    if (!API) return null;
    const description=$('#report-description')?.value?.trim()||'';
    if (!description) return null;
    const position=await getPosition();
    const file=$('#photo-upload')?.files?.[0];
    const payload={title:description.slice(0,70),description,category:$('#report-category')?.value||'other',latitude:position.lat,longitude:position.lng,locationLabel:position.accuracy?'Current location':'Bengaluru',anonymous:Boolean($('#anonymous-toggle')?.checked),photoUrl:null};
    try {
      const r=await fetch(`${API}/api/issues`,{method:'POST',headers:{'Content-Type':'application/json','X-Device-ID':getDeviceId()},body:JSON.stringify(payload)});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const issue=await r.json();
      window.dispatchEvent(new CustomEvent('koinos:created',{detail:{...issue,photoName:file?.name||null}}));
      return issue;
    } catch(e) { console.warn('KOINOS report save failed',e); return null; }
  }

  async function upvote(issueId) {
    if (!API || !issueId || String(issueId).startsWith('demo-')) return null;
    try { const r=await fetch(`${API}/api/issues/${encodeURIComponent(issueId)}/upvote`,{method:'POST',headers:{'X-Device-ID':getDeviceId()}}); return r.ok?await r.json():null; } catch { return null; }
  }

  function filterMap(category='all') {
    const items=window.KOINOS_MAP?.markers||[];
    items.forEach(m=>{ const match=category==='all'||m.__issue?.category===category|| (category==='roads'&&m.__issue?.category==='roads'); m.setOpacity(match?1:.18); });
  }

  window.KOINOS_LIVE={submitReport,upvote,getPosition,initRealMap,filterMap,apiBase:API};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initRealMap); else initRealMap();
})();
