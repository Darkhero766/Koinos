(() => {
  const CONFIG = window.KOINOS_CONFIG || {};
  const APIS = CONFIG.apiCandidates || [window.KOINOS_API_BASE, 'https://koinos-api-5v03.onrender.com', 'https://koinos-api.onrender.com'].filter(Boolean);
  const PHOTO_BUCKET = CONFIG.photoBucket || 'issue-images';
  const $ = s => document.querySelector(s);
  let map, marker, point, activeApi = APIS[0] || '', supabaseClientPromise = null;

  async function api(path, options = {}) {
    let last;
    for (const base of [...new Set([activeApi, ...APIS].filter(Boolean))]) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        let r;
        try { r = await fetch(`${base.replace(/\/$/, '')}${path}`, { ...options, signal: controller.signal, cache: 'no-store' }); }
        finally { clearTimeout(timer); }
        const text = await r.text(); let body = {};
        try { body = JSON.parse(text); } catch {}
        if (!r.ok) throw Error(body.error || `Civic service returned ${r.status}`);
        activeApi = base; return body;
      } catch (e) { last = e; }
    }
    if (last?.name === 'AbortError') throw Error('KOINOS civic service took too long to respond. Please try again.');
    if (last instanceof TypeError) throw Error('KOINOS civic service is temporarily unreachable. Please try again in a few seconds.');
    throw last || Error('KOINOS civic service is unavailable.');
  }

  async function pos() { return new Promise(resolve => { if (!navigator.geolocation) return resolve(null); navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }); }); }
  async function address(p) { try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}`, { headers: { 'Accept-Language': 'en' } }); const x = await r.json(); return x.display_name || 'Pinned location'; } catch { return 'Pinned location'; } }
  async function setPoint(p) { point = p; marker?.setLatLng([p.lat, p.lng]); map?.setView([p.lat, p.lng], 17); $('#location-note').textContent = `${(await address(p)).slice(0, 140)} · ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`; }

  async function compress(file) {
    if (!file) return null;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw Error('Choose a JPG, PNG or WebP image.');
    if (file.size > 12 * 1024 * 1024) throw Error('Please choose an image under 12 MB.');
    try {
      const url = URL.createObjectURL(file), im = new Image();
      await new Promise((resolve, reject) => { im.onload = resolve; im.onerror = reject; im.src = url; });
      const max = 1600, scale = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.naturalWidth * scale)); c.height = Math.max(1, Math.round(im.naturalHeight * scale));
      const ctx = c.getContext('2d', { alpha: false }); if (!ctx) throw Error('Image processor unavailable');
      ctx.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      let blob = null;
      for (const quality of [.78, .68, .58, .48]) { blob = await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', quality)); if (blob && blob.size <= 1500 * 1024) break; }
      return blob ? new File([blob], `koinos-${Date.now()}.jpg`, { type: 'image/jpeg' }) : file;
    } catch (e) { if (e?.message === 'Image processor unavailable') throw e; return file; }
  }

  async function getStorageClient() {
    if (window.KOINOS_AUTH?.client) return window.KOINOS_AUTH.client;
    const c = window.KOINOS_SUPABASE || {};
    if (!c.url || c.url.startsWith('PASTE_') || !c.anonKey || c.anonKey.startsWith('PASTE_')) return null;
    if (!supabaseClientPromise) supabaseClientPromise = (async () => {
      if (!window.supabase) await new Promise((resolve, reject) => {
        const existing = document.querySelector('[data-koinos-supabase-sdk]');
        if (existing) { existing.addEventListener('load', resolve, { once: true }); existing.addEventListener('error', reject, { once: true }); return; }
        const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'; s.dataset.koinosSupabaseSdk = '1'; s.onload = resolve; s.onerror = () => reject(Error('Supabase client could not load')); document.head.appendChild(s);
      });
      return window.supabase.createClient(c.url, c.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    })();
    return supabaseClientPromise;
  }

  const dataUrlFallback = file => new Promise(resolve => { if (!file || file.size > 2 * 1024 * 1024) return resolve(null); const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => resolve(null); r.readAsDataURL(file); });

  async function uploadPhoto(file) {
    if (!file) return null;
    const prepared = await compress(file);
    try {
      const client = await getStorageClient();
      if (!client) return dataUrlFallback(prepared);
      let user = null; try { user = (await client.auth.getUser()).data?.user || null; } catch {}
      const device = localStorage.getItem('koinos-device-id') || (crypto.randomUUID?.() || String(Date.now()));
      localStorage.setItem('koinos-device-id', device);
      const folder = user?.id || `anonymous/${device}`;
      const safe = prepared.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80) || 'photo.jpg';
      const path = `${folder}/${Date.now()}-${safe}`;
      const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, prepared, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
      if (error) throw error;
      const { data } = client.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) throw Error('Supabase did not return a public photo URL.');
      return data.publicUrl;
    } catch (e) {
      console.warn('KOINOS photo storage failed:', e);
      const fallback = await dataUrlFallback(prepared);
      if (fallback) return fallback;
      throw Error(`Photo upload failed: ${e?.message || 'check Supabase Storage policies'}`);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    map = L.map('report-map').setView([28.6139, 77.209], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
    const p = await pos(), start = p || { lat: 28.6139, lng: 77.209 };
    marker = L.marker([start.lat, start.lng], { draggable: true }).addTo(map);
    marker.on('dragend', () => setPoint(marker.getLatLng())); map.on('click', e => setPoint(e.latlng)); await setPoint(start);
    $('#gps').onclick = async () => { const x = await pos(); if (x) setPoint(x); else $('#message').textContent = 'Location permission was not available. Search or tap the map instead.'; };
    $('#photo').onchange = async () => { const f = $('#photo').files?.[0]; if (!f) return; try { const data = await compress(f); $('#preview').src = URL.createObjectURL(data); $('#preview').classList.remove('hidden'); $('#file-note').textContent = `Photo ready · ${(data.size / 1024 / 1024).toFixed(1)} MB after compression.`; } catch (e) { $('#photo').value = ''; $('#message').textContent = e.message; } };
    $('#search').onchange = async () => { const q = $('#search').value.trim(); if (!q) return; try { const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'en' } }), a = await r.json(); if (a[0]) setPoint({ lat: Number(a[0].lat), lng: Number(a[0].lon) }); } catch {} };
    $('#submit').onclick = async () => {
      const desc = $('#description').value.trim(); if (!desc) return $('#message').textContent = 'Add a short description.';
      if (!point) return $('#message').textContent = 'Choose the exact location.';
      const file = $('#photo').files?.[0] || null; $('#submit').disabled = true; $('#message').textContent = 'Saving your report…';
      try {
        const photoUrl = await uploadPhoto(file), device = localStorage.getItem('koinos-device-id') || (crypto.randomUUID?.() || String(Date.now())); localStorage.setItem('koinos-device-id', device);
        const token = await window.KOINOS_AUTH?.getAccessToken?.();
        const body = { title: desc.slice(0, 70), description: desc, category: $('#category').value, latitude: point.lat, longitude: point.lng, locationLabel: await address(point), anonymous: $('#anonymous').checked, photoUrl };
        const x = await api('/api/issues', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-ID': device, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
        $('#message').innerHTML = `Report saved. ${x.communityMatch ? '<b>KOINOS found related nearby reports.</b>' : ''} <a href="/track.html">Track it →</a>`;
        $('#submit').textContent = 'Report saved ✓';
      } catch (e) { $('#message').textContent = e.message || 'Civic service is temporarily unreachable. Please try again.'; $('#submit').disabled = false; }
    };
  });
})();
