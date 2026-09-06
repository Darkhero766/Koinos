/* KOINOS frontend patch: resilient image picker + real home location */
const API = window.KOINOS_API_URL || 'https://koinos-api-5v03.onrender.com';

function setText(id, text) { const el=document.getElementById(id); if(el) el.textContent=text; }

// Never force the camera: let iPad/iPhone show Photos/Files.
function wireImagePicker() {
  document.querySelectorAll('input[type="file"]').forEach(input => {
    input.removeAttribute('capture');
    input.setAttribute('accept','image/*');
    input.addEventListener('change', () => {
      const file=input.files && input.files[0];
      if(!file) return;
      if(!file.type.startsWith('image/')) { input.value=''; alert('Please choose an image.'); return; }
      if(file.size > 4*1024*1024) { input.value=''; alert('Image must be smaller than 4 MB.'); return; }
      const preview=input.parentElement?.querySelector('img[data-upload-preview]');
      if(preview) { preview.src=URL.createObjectURL(file); preview.hidden=false; }
      const name=input.parentElement?.querySelector('[data-upload-name]');
      if(name) name.textContent=file.name;
    }, {once:true});
  });
}

// Real GPS: no MG Road/Bengaluru fallback. Returns null when unavailable.
window.KOINOS_LOCATION = {
  async get(options={}) {
    if(!navigator.geolocation) throw new Error('This device does not provide location services.');
    return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),
      e=>reject(new Error(e.code===1?'Location permission was denied.':e.code===2?'Your location could not be determined.':'Location request timed out.')),
      {enableHighAccuracy:true,timeout:15000,maximumAge:0,...options}
    ));
  }
};

// Home map: load a real Leaflet map and center on the user's live GPS position.
window.KOINOS_HOME_MAP = {
  map:null, marker:null,
  async init(containerId='home-map') {
    const el=document.getElementById(containerId); if(!el) return;
    if(typeof L==='undefined') { el.innerHTML='<div class="map-status">Map library is loading…</div>'; return; }
    if(this.map) return this.map;
    this.map=L.map(el,{zoomControl:true}).setView([20.5937,78.9629],5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(this.map);
    const status=L.control({position:'topright'}); status.onAdd=()=>{const d=L.DomUtil.create('div','map-location-status');d.textContent='Locating you…';d.style.cssText='background:#fff;padding:8px 10px;border-radius:10px;box-shadow:0 2px 10px #0002;font-size:12px';return d}; status.addTo(this.map);
    try {
      const pos=await window.KOINOS_LOCATION.get();
      this.map.setView([pos.lat,pos.lng],16);
      this.marker=L.marker([pos.lat,pos.lng]).addTo(this.map).bindPopup(`You are here · ±${Math.round(pos.accuracy)}m`).openPopup();
      status.getContainer().textContent='Live location';
      this.loadNearby(pos.lat,pos.lng);
    } catch(e) {
      status.getContainer().textContent='Location unavailable — tap “Use my location”';
    }
    setTimeout(()=>this.map.invalidateSize(),150);
    return this.map;
  },
  async loadNearby(lat,lng) {
    try {
      const r=await fetch(`${API}/api/issues?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=10`);
      if(!r.ok) return;
      const data=await r.json();
      const issues=data.issues||data||[];
      issues.forEach(i=>{if(i.latitude==null||i.longitude==null)return;L.marker([i.latitude,i.longitude]).addTo(this.map).bindPopup(`<b>${i.title||i.category||'Civic issue'}</b><br>${i.status||'Reported'}`);});
    } catch(_) {}
  }
};

document.addEventListener('DOMContentLoaded',()=>{ wireImagePicker(); window.KOINOS_HOME_MAP.init(); });
