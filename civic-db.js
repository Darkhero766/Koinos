/* KOINOS direct civic database bridge. */
(() => {
  const clean = (v, n = 5000) => String(v ?? '').trim().slice(0, n);
  const severity = text => {
    const t = String(text || '').toLowerCase();
    if (/school|hospital|accident|injur|fire|flood|collapse|exposed wire|electric shock|danger|unsafe|open manhole|sewer/.test(t)) return 'high';
    if (/pothole|leak|overflow|broken|damaged|blocked|garbage|waste|streetlight|drain/.test(t)) return 'medium';
    return 'low';
  };
  const priority = sev => sev === 'high' ? 65 : sev === 'medium' ? 50 : 35;
  const normalize = r => ({
    id: r.id, title: r.title, category: r.category, description: r.description,
    locationLabel: r.location_label, latitude: r.latitude, longitude: r.longitude,
    photoUrl: r.photo_url, anonymous: r.anonymous, status: r.status,
    severity: r.severity, priority: r.priority, upvotes: r.upvotes,
    createdAt: r.created_at, updatedAt: r.updated_at
  });
  const client = async () => {
    if (window.KOINOS_AUTH?.client) return window.KOINOS_AUTH.client;
    const ready = window.KOINOS_AUTH_READY;
    if (ready) return ready;
    return null;
  };
  const deviceId = () => {
    let id = localStorage.getItem('koinos-device-id');
    if (!id) { id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`; localStorage.setItem('koinos-device-id', id); }
    return id;
  };
  const trackedIds = () => {
    try { return JSON.parse(localStorage.getItem('koinos-tracked-report-ids') || '[]').filter(Boolean).map(String).slice(-100); }
    catch { return []; }
  };
  const rememberReport = id => {
    if (!id) return;
    const next = [...new Set([...trackedIds(), String(id)])].slice(-100);
    localStorage.setItem('koinos-tracked-report-ids', JSON.stringify(next));
  };
  async function createIssue(input) {
    const c = await client(); if (!c) throw new Error('Supabase is not configured.');
    const user = (await c.auth.getUser()).data?.user || null;
    const desc = clean(input.description, 3000), title = clean(input.title || desc.slice(0, 70) || 'Civic issue', 100);
    const sev = severity(`${title} ${desc}`);
    const row = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      title, category: clean(input.category, 30) || 'other', description: desc,
      location_label: clean(input.locationLabel, 180) || null,
      latitude: Number(input.latitude), longitude: Number(input.longitude),
      photo_url: clean(input.photoUrl, 12000000) || null,
      anonymous: Boolean(input.anonymous), owner_user_id: input.anonymous ? null : (user?.id || null),
      status: 'reported', severity: sev, priority: priority(sev), upvotes: 0
    };
    const { data, error } = await c.from('issues').insert(row).select('*').single();
    if (error) throw error;
    rememberReport(data.id);
    try { await c.from('issue_events').insert({ issue_id: row.id, status: 'reported', note: 'Report received' }); } catch {}
    return normalize(data);
  }
  async function listIssues({lat, lng, radiusKm = 30} = {}) {
    const c = await client(); if (!c) throw new Error('Supabase is not configured.');
    const { data, error } = await c.from('issues').select('*').order('priority', {ascending:false}).order('created_at', {ascending:false}).limit(200);
    if (error) throw error;
    let rows = (data || []).map(normalize);
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      const r = Number(radiusKm) || 30, rad = Math.PI / 180;
      rows = rows.filter(x => {
        if (!Number.isFinite(Number(x.latitude)) || !Number.isFinite(Number(x.longitude))) return false;
        const p1 = Number(lat) * rad, p2 = Number(x.latitude) * rad, dp = (Number(x.latitude) - Number(lat)) * rad, dl = (Number(x.longitude) - Number(lng)) * rad;
        const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) <= r;
      });
    }
    return rows;
  }
  async function listMine() {
    const c = await client(); if (!c) throw new Error('Supabase is not configured.');
    const user = (await c.auth.getUser()).data?.user || null, ids = trackedIds(), results = new Map();
    if (user) {
      const { data, error } = await c.from('issues').select('*').eq('owner_user_id', user.id).order('created_at', {ascending:false}).limit(200);
      if (error) throw error; (data || []).map(normalize).forEach(x => results.set(String(x.id), x));
    }
    if (ids.length) {
      const { data, error } = await c.from('issues').select('*').in('id', ids);
      if (!error) (data || []).map(normalize).forEach(x => results.set(String(x.id), x));
    }
    return [...results.values()].sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }
  async function upvote(id) {
    const c = await client(); if (!c) throw new Error('Supabase is not configured.');
    const { data, error } = await c.rpc('koinos_upvote_issue', { p_issue_id: String(id), p_device_id: deviceId() });
    if (error) throw error; if (!data) throw new Error('Issue not found.');
    return typeof data === 'string' ? JSON.parse(data) : data;
  }
  async function updateIssueStatus(id, status, note = '') {
    const c = await client(); if (!c) throw new Error('Supabase is not configured.');
    const { data, error } = await c.rpc('koinos_authority_update_issue', { p_issue_id: String(id), p_status: String(status), p_note: clean(note, 500) });
    if (error) throw error;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }
  window.KOINOS_DB = { client, createIssue, listIssues, listMine, upvote, updateIssueStatus, normalize, trackedIds };
})();
