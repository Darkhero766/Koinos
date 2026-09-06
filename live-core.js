/* KOINOS — resilient civic layer: GPS + OpenStreetMap + persistent API + Supabase photo storage. */
(() => {
  const CONFIG = window.KOINOS_CONFIG || {};
  const API_CANDIDATES = CONFIG.apiCandidates || [window.KOINOS_API_BASE, 'https://koinos-api-5v03.onrender.com', 'https://koinos-api.onrender.com'].filter(Boolean);
  const PHOTO_BUCKET = CONFIG.photoBucket || 'issue-images';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>\'\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const error = message => window.dispatchEvent(new CustomEvent('koinos:error', { detail: { message } }));
  const device = () => { let id = localStorage.getItem('koinos-device-id'); if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; localStorage.setItem('koinos-device-id', id); } return id; };
  const position = () => new Promise(resolve => { if (!navigator.geolocation) return resolve(null); navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, source: 'gps' }), () => resolve(null), { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }); });
  async function reverse(p) { try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}&zoom=18&addressdetails=1`, { headers: { Accept: 'application/json', 'Accept-Language': 'en' } }); if (!r.ok) throw 0; const x = await r.json(), a = x.address || {}; return [a.road || a.pedestrian, a.neighbourhood || a.suburb, a.city || a.town || a.village, a.state].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3).join(', ') || 'Pinned location'; } catch { return 'Pinned location'; } }
  async function search(q) { try { if (!q.trim()) return []; const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json', 'Accept-Language': 'en' } }); return r.ok ? await r.json() : []; } catch { return []; } }
  const leaflet = () => new Promise((resolve, reject) => { if (window.L) return resolve(window.L); if (!document.querySelector('[data-koinos-leaflet-css]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; l.dataset.koinosLeafletCss = '1'; document.head.appendChild(l); } const old = document.querySelector('[data-koinos-leaflet-js]'); if (old) { old.addEventListener('load', () => window.L ? resolve(window.L) : reject(Error('Map unavailable')), { once: true }); return; } const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.dataset.koinosLeafletJs = '1'; s.onload = () => window.L ? resolve(window.L) : reject(Error('Map unavailable')); s.onerror = () => reject(Error('Map unavailable')); document.head.appendChild(s); });
  let activeApi = API_CANDIDATES[0] || '';
  async function apiRequest(path, options = {}) { let lastError = null; for (const base of [...new Set([activeApi, ...API_CANDIDATES].filter(Boolean))]) { try { const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000); let r; try { r = await fetch(`${base.replace(/\/$/, '')}${path}`, { ...options, signal: controller.signal, cache: options.cache || 'no-store' }); } finally { clearTimeout(timer); } const text = await r.text(); let body = {}; try { body = JSON.parse(text); } catch {} if (!r.ok) throw Error(body.error || `Civic service returned ${r.status}`); activeApi = base; return body; } catch (e) { lastError = e; } } if (lastError?.name === 'AbortError') throw Error('KOINOS civic service took too long to respond. Please try again.'); if (lastError instanceof TypeError) throw Error('KOINOS civic service is temporarily unreachable. Please try again in a few seconds.'); throw lastError || Error('KOINOS civic service is unavailable.'); }
  async function getIssues(p) { try { const qs = p ? `?lat=${p.lat}&lng=${p.lng}&radiusKm=25` : '?radiusKm=100'; const b = await apiRequest(`/api/issues${qs}`, { headers: { Accept: 'application/json' } }); return Array.isArray(b) ? b : []; } catch (e) { console.error(e); return []; } }
  const icon = (L, sev) => L.divIcon({ className: 'koinos-live-marker', html: `<span data-severity="${esc(sev || 'low')}"></span>`, iconSize: [28, 28], iconAnchor: [14, 14] });
  function addMarkers(L, map, issues) { const markers = []; issues.forEach(i => { const lat = Number(i.latitude), lng = Number(i.longitude); if (!Number.isFinite(lat) || !Number.isFinite(lng)) return; const m = L.marker([lat, lng], { icon: icon(L, i.severity) }).addTo(map); m.__issue = i; m.bindPopup(`<strong>${esc(i.title || 'Civic issue')}</strong><br>${esc(i.locationLabel || 'Pinned location')}<br><b>${i.upvotes || 0}</b> supporters`); m.on('click', () => window.dispatchEvent(new CustomEvent('koinos:issue', { detail: i }))); markers.push(m); }); return markers; }
  let maps = {};
  async function initHomeMap() { const host = $('.hero-visual'); if (!host || host.dataset.koinosHomeMap) return; host.dataset.koinosHomeMap = '1'; try { const L = await leaflet(), p = await position(); host.innerHTML = '<div class="koinos-home-map" id="koinos-home-map"></div><div class="koinos-map-status" id="koinos-home-status">Locating you…</div><div class="koinos-map-glow"></div>'; const center = p || { lat: 20.5937, lng: 78.9629 }, map = L.map($('#koinos-home-map'), { zoomControl: false, scrollWheelZoom: false }).setView([center.lat, center.lng], p ? 15 : 5); L.control.zoom({ position: 'topright' }).addTo(map); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map); if (p) L.circleMarker([p.lat, p.lng], { radius: 8, weight: 3, fillOpacity: 1 }).addTo(map).bindPopup('Your current location'); const issues = await getIssues(p), markers = addMarkers(L, map, issues); const st = $('#koinos-home-status'); if (st) st.textContent = p ? '● Live location · civic issues nearby' : 'Location not shared · showing India'; maps.home = { map, markers, issues, position: p }; setTimeout(() => map.invalidateSize(), 250); } catch (e) { console.error(e); host.innerHTML = '<div class="koinos-map-empty"><strong>Live map unavailable.</strong><span>You can still report an issue or open Live issues.</span></div>'; } }
  async function initRealMap() { const host = $('#big-map'); if (!host || host.dataset.koinosRealMap) return; host.dataset.koinosRealMap = '1'; try { const L = await leaflet(), p = await position(); host.innerHTML = '<div class="koinos-explore-map" id="koinos-explore-map"></div><div class="koinos-map-status" id="koinos-explore-status">Locating you…</div>'; const center = p || { lat: 20.5937, lng: 78.9629 }, map = L.map(host, { zoomControl: true }).setView([center.lat, center.lng], p ? 15 : 5); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map); if (p) L.circleMarker([p.lat, p.lng], { radius: 8, weight: 3, fillOpacity: 1 }).addTo(map); const issues = await getIssues(p), markers = addMarkers(L, map, issues); const st = $('#koinos-explore-status'); if (st) st.textContent = p ? '● Live location' : 'India-wide view'; maps.explore = { map, markers, issues, position: p }; setTimeout(() => map.invalidateSize(), 250); } catch (e) { console.error(e); host.innerHTML = '<div class="koinos-map-empty"><strong>Map unavailable.</strong><span>Check your connection and reload.</span></div>'; } }
  let report = { ready: false, map: null, marker: null, point: null };
  function setPoint(p, label) { if (!p) return; report.point = { ...p, lat: Number(p.lat), lng: Number(p.lng), locationLabel: label || 'Pinned location' }; report.ready = true; const n = $('#report-location-name'), s = $('#report-location-sub'); if (n) n.textContent = report.point.locationLabel; if (s) s.textContent = `${report.point.lat.toFixed(5)}, ${report.point.lng.toFixed(5)}${report.point.accuracy ? ` · ±${Math.round(report.point.accuracy)}m` : ''}`; if (report.marker) { report.marker.setLatLng([report.point.lat, report.point.lng]); report.map?.setView([report.point.lat, report.point.lng], 17); } }
  async function choose(latlng) { const p = { lat: Number(latlng.lat), lng: Number(latlng.lng), accuracy: null, source: 'pin' }; setPoint(p, 'Finding address…'); setPoint(p, await reverse(p)); }
  async function initReportLocation() { const host = $('.report-step[data-step="2"] .mini-map'); if (!host || host.dataset.ready) return; host.dataset.ready = '1'; host.innerHTML = '<div class="koinos-location-map" id="report-location-map"></div><div class="koinos-location-tools"><input id="location-search" type="search" placeholder="Search a road, landmark or area" autocomplete="off"><button id="use-my-location" type="button">⌖ Use my location</button></div><div id="location-results" class="koinos-location-results" hidden></div><p class="koinos-location-help">Tap the map or drag the pin to the exact spot.</p>'; try { const L = await leaflet(), p = await position(), c = p || { lat: 20.5937, lng: 78.9629 }; report.map = L.map($('#report-location-map'), { zoomControl: true }).setView([c.lat, c.lng], p ? 17 : 5); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(report.map); report.marker = L.marker([c.lat, c.lng], { draggable: true }).addTo(report.map); report.marker.on('dragend', () => choose(report.marker.getLatLng())); report.map.on('click', e => choose(e.latlng)); if (p) setPoint(p, await reverse(p)); const input = $('#location-search'), results = $('#location-results'); input?.addEventListener('input', () => { clearTimeout(window.__loc); window.__loc = setTimeout(async () => { const rows = await search(input.value); results.innerHTML = rows.map((x, i) => `<button type="button" data-i="${i}">${esc(x.display_name)}</button>`).join(''); results.__rows = rows; results.hidden = !rows.length; }, 450); }); results?.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; const x = results.__rows?.[Number(b.dataset.i)]; if (!x) return; results.hidden = true; const p2 = { lat: Number(x.lat), lng: Number(x.lon), accuracy: null, source: 'search' }; report.map.setView([p2.lat, p2.lng], 17); report.marker.setLatLng([p2.lat, p2.lng]); setPoint(p2, x.display_name); }); $('#use-my-location')?.addEventListener('click', async () => { const x = await position(); if (!x) return error('Location access is unavailable. Enable Location Services or search for the exact place.'); report.map.setView([x.lat, x.lng], 17); report.marker.setLatLng([x.lat, x.lng]); setPoint(x, await reverse(x)); }); setTimeout(() => report.map.invalidateSize(), 250); } catch (e) { console.error(e); error('Could not load the location map. Please reload.'); } }
  async function confirmLocation() { if (!report.ready) { error('Choose the exact location before continuing.'); return false; } return true; }
  const readFile = f => new Promise(resolve => { if (!f || !f.type?.startsWith('image/') || f.size > 2 * 1024 * 1024) return resolve(null); const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => resolve(null); r.readAsDataURL(f); });
  async function preparePhoto(file) {
    if (!file || !file.type?.startsWith('image/')) return null;
    if (file.size > 12 * 1024 * 1024) throw Error('Please choose an image under 12 MB.');
    if (file.type === 'image/heic' || file.type === 'image/heif') throw Error('HEIC/HEIF photos are not supported yet. Choose JPG, PNG or WebP.');
    try {
      const url = URL.createObjectURL(file), img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
      const max = 1600, scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw Error('Image processor unavailable');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url);
      let blob = null;
      for (const quality of [.78, .68, .58, .48]) {
        blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= 1500 * 1024) break;
      }
      return blob ? new File([blob], `koinos-${Date.now()}.jpg`, { type: 'image/jpeg' }) : file;
    } catch (e) {
      if (e?.message?.includes('HEIC') || e?.message?.includes('processor')) throw e;
      return file;
    }
  }
  let supabaseClientPromise = null;
  async function getStorageClient() {
    if (window.KOINOS_AUTH?.client) return window.KOINOS_AUTH.client;
    const c = window.KOINOS_SUPABASE || {};
    if (!c.url || c.url.startsWith('PASTE_') || !c.anonKey || c.anonKey.startsWith('PASTE_')) return null;
    if (!supabaseClientPromise) {
      supabaseClientPromise = (async () => {
        if (!window.supabase) {
          await new Promise((resolve, reject) => {
            const existing = document.querySelector('[data-koinos-supabase-sdk]');
            if (existing) { existing.addEventListener('load', resolve, { once: true }); existing.addEventListener('error', reject, { once: true }); return; }
            const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'; s.dataset.koinosSupabaseSdk = '1'; s.onload = resolve; s.onerror = () => reject(Error('Supabase client could not load')); document.head.appendChild(s);
          });
        }
        return window.supabase.createClient(c.url, c.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      })();
    }
    return supabaseClientPromise;
  }
  async function uploadPhoto(file) {
    if (!file) return null;
    const prepared = await preparePhoto(file);
    if (!prepared) return null;
    try {
      const client = await getStorageClient();
      if (!client) return await readFile(prepared);
      let user = null;
      try { user = (await client.auth.getUser()).data?.user || null; } catch {}
      const folder = user?.id || `anonymous/${device()}`;
      const safe = prepared.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80) || 'photo.jpg';
      const path = `${folder}/${Date.now()}-${safe}`;
      const { error: uploadError } = await client.storage.from(PHOTO_BUCKET).upload(path, prepared, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
      if (uploadError) throw uploadError;
      const { data } = client.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) throw Error('Supabase did not return a public photo URL.');
      return data.publicUrl;
    } catch (e) {
      console.warn('KOINOS photo storage failed:', e);
      const fallback = await readFile(prepared);
      if (fallback) return fallback;
      throw Error(`Photo upload failed: ${e?.message || 'check Supabase Storage policies'}`);
    }
  }
  function setupPhoto() { const input = $('#photo-upload'); if (!input) return; input.accept = 'image/jpeg,image/png,image/webp'; input.addEventListener('change', async () => { const f = input.files?.[0]; if (!f) return; if (!/^image\/(jpeg|png|webp)$/i.test(f.type) || f.size > 12 * 1024 * 1024) { input.value = ''; return error('Choose a JPG, PNG or WebP image under 12 MB.'); } const name = $('#file-name'); if (name) name.textContent = `${f.name} · preparing…`; let img = $('#photo-preview'); if (!img) { img = document.createElement('img'); img.id = 'photo-preview'; img.alt = 'Selected issue photo'; img.className = 'photo-preview'; input.parentElement?.appendChild(img); } const prepared = await preparePhoto(f).catch(e => { error(e.message || 'Could not prepare this photo.'); return null; }); if (!prepared) { input.value = ''; return; } const url = URL.createObjectURL(prepared); img.src = url; img.hidden = false; if (name) name.textContent = `${f.name} · ${(prepared.size / 1024 / 1024).toFixed(1)} MB ready`; setTimeout(() => URL.revokeObjectURL(url), 60000); }); }
  async function submitReport() { const description = $('#report-description')?.value?.trim() || ''; if (!description) { error('Add a short description before submitting.'); return null; } if (!report.ready) { error('Choose the exact location before submitting.'); return null; } const f = $('#photo-upload')?.files?.[0] || null; let photoUrl = null; try { photoUrl = await uploadPhoto(f); } catch (e) { error(e.message || 'We could not upload that photo.'); return null; } const payload = { title: description.slice(0, 70), description, category: $('#report-category')?.value || 'other', latitude: report.point.lat, longitude: report.point.lng, locationLabel: report.point.locationLabel, anonymous: Boolean($('#anonymous-toggle')?.checked), photoUrl }; try { const token = await window.KOINOS_AUTH?.getAccessToken?.(); const b = await apiRequest('/api/issues', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-ID': device(), Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) }); window.dispatchEvent(new CustomEvent('koinos:created', { detail: b })); return b; } catch (e) { console.error('KOINOS submit', e); error(e.message || 'Could not save report'); return null; } }
  async function refresh(issue) { for (const key of ['home', 'explore']) { const m = maps[key]; if (!m) continue; const issues = await getIssues(m.position); m.issues = issues; m.markers.forEach(x => x.remove()); m.markers = addMarkers(window.L, m.map, issues); if (issue?.latitude && key === 'home') m.map.setView([Number(issue.latitude), Number(issue.longitude)], 17); } }
  async function upvote(id) { try { const token = await window.KOINOS_AUTH?.getAccessToken?.(); return await apiRequest(`/api/issues/${encodeURIComponent(id)}/upvote`, { method: 'POST', headers: { 'X-Device-ID': device(), Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } }); } catch { return null; } }
  function filterMap(cat = 'all') { (maps.explore?.markers || []).forEach(m => { const ok = cat === 'all' || m.__issue?.category === cat; m.setOpacity(ok ? 1 : .2); }); }
  window.KOINOS_LIVE = { apiBase: () => activeApi, getPosition: position, reverseGeocode: reverse, initHomeMap, initRealMap, initReportLocation, confirmLocation, submitReport, refreshAfterCreate: refresh, upvote, filterMap, deviceId: device };
  const boot = () => { setupPhoto(); initHomeMap(); initRealMap(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('koinos:report-open', () => setTimeout(initReportLocation, 100));
  window.addEventListener('koinos:created', e => refresh(e.detail));
})();
