/* Direct report submit path for the static deployment.
   This path intentionally writes to Supabase directly. It does not wait on Render,
   so a sleeping civic API cannot make Submit report hang. */
(() => {
  const $ = s => document.querySelector(s);
  const message = text => { const el = $('#message'); if (el) el.textContent = text; };
  async function client() { return window.KOINOS_DB?.client?.(); }

  async function compress(file) {
    if (!file) return null;
    if (!file.type?.startsWith('image/')) throw Error('Please choose an image file.');
    if (file.size > 12 * 1024 * 1024) throw Error('Please choose an image under 12 MB.');
    if (/heic|heif/i.test(file.type)) throw Error('HEIC/HEIF is not supported by this browser. Choose a JPG, PNG or WebP copy from Files.');
    const url = URL.createObjectURL(file), img = new Image();
    try {
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
      const max = 1600, scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw Error('Image processor unavailable.');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const quality of [.78, .68, .58, .48]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= 1400 * 1024) return new File([blob], `koinos-${Date.now()}.jpg`, { type: 'image/jpeg' });
      }
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .42));
      return blob ? new File([blob], `koinos-${Date.now()}.jpg`, { type: 'image/jpeg' }) : file;
    } finally { URL.revokeObjectURL(url); }
  }

  const dataUrl = file => new Promise((resolve, reject) => {
    if (!file || file.size > 1900 * 1024) return resolve(null);
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read the selected photo.'));
    r.readAsDataURL(file);
  });

  async function upload(file) {
    if (!file) return null;
    const prepared = await compress(file);
    const c = await client();
    if (!c) return dataUrl(prepared);
    const user = (await c.auth.getUser()).data?.user || null;
    const device = localStorage.getItem('koinos-device-id') || (crypto.randomUUID?.() || String(Date.now()));
    localStorage.setItem('koinos-device-id', device);
    const folder = user?.id || `anonymous/${device}`;
    const safeName = prepared.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80) || 'photo.jpg';
    const path = `${folder}/${Date.now()}-${safeName}`;

    // Storage is preferred, but a broken Storage policy must never make the civic
    // report itself fail. The compressed data URL is deliberately small and is used
    // only as a last-resort demo fallback.
    try {
      const result = await Promise.race([
        c.storage.from('issue-images').upload(path, prepared, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Photo storage timed out')), 9000)),
      ]);
      if (result.error) throw result.error;
      return c.storage.from('issue-images').getPublicUrl(path).data.publicUrl;
    } catch (e) {
      console.warn('KOINOS photo storage fallback:', e);
      const fallback = await dataUrl(prepared);
      if (fallback) return fallback;
      throw Error(`Photo upload failed: ${e?.message || 'please choose a smaller JPG/PNG/WebP image'}`);
    }
  }

  async function reverse(p) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}`, { headers: { 'Accept-Language': 'en' } });
      const x = await r.json();
      return x.display_name || 'Pinned location';
    } catch { return 'Pinned location'; }
  }

  function readPoint() {
    // report-page.js writes the human-readable note as "address · lat, lng".
    // Keep parsing tolerant of whitespace, line breaks and signed coordinates.
    const note = $('#location-note')?.textContent || '';
    const match = note.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/s);
    if (!match) return null;
    const lat = Number(match[1]), lng = Number(match[2]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const input = $('#photo'), button = $('.photo-picker-button');
    button?.addEventListener('click', e => { e.preventDefault(); input?.click(); });

    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const prepared = await compress(file);
        $('#preview').src = URL.createObjectURL(prepared);
        $('#preview').classList.remove('hidden');
        $('#file-note').textContent = `Photo ready · ${(prepared.size / 1024 / 1024).toFixed(1)} MB after compression.`;
      } catch (e) {
        input.value = '';
        message(e.message || 'Could not read that photo.');
      }
    });

    document.addEventListener('click', async e => {
      const submit = e.target.closest?.('#submit');
      if (!submit) return;
      e.preventDefault();
      e.stopImmediatePropagation();

      const desc = $('#description')?.value.trim();
      const category = $('#category')?.value || 'other';
      const point = readPoint();
      if (!desc) return message('Add a short description.');
      if (!point) return message('Choose the exact location on the map.');

      submit.disabled = true;
      message('Saving securely…');
      try {
        const photoUrl = await upload(input?.files?.[0] || null);
        const auth = await window.KOINOS_AUTH_READY;
        const user = auth ? (await auth.auth.getUser()).data?.user : null;
        const anonymousChecked = Boolean($('#anonymous')?.checked);
        const anonymous = anonymousChecked || !user;
        const row = await window.KOINOS_DB.createIssue({
          title: desc.slice(0, 70),
          description: desc,
          category,
          latitude: point.lat,
          longitude: point.lng,
          locationLabel: await reverse(point),
          anonymous,
          photoUrl,
        });
        message(`Report saved ✓ ${row.title}. ${anonymousChecked ? 'Submitted anonymously.' : user ? 'Linked to your account.' : 'Saved anonymously — sign in next time to track reports.'}`);
        submit.textContent = 'Report saved ✓';
      } catch (err) {
        console.error('KOINOS direct report:', err);
        message(err?.message || 'Could not save the report. Please try again.');
        submit.disabled = false;
      }
    }, true);
  });
})();
