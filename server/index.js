import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, max: 10 }) : null;
const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(x => x.trim()) : '*' }));
app.use(express.json({ limit: '6mb' }));

const fallbackFile = path.join(__dirname, 'data', 'issues.json');
const ensureFallback = async () => { try { await fs.access(fallbackFile); } catch { await fs.mkdir(path.dirname(fallbackFile), { recursive: true }); await fs.writeFile(fallbackFile, '[]'); } };

const initDb = async () => {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      description TEXT NOT NULL DEFAULT '',
      location_label TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      photo_url TEXT,
      anonymous BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'reported',
      severity TEXT NOT NULL DEFAULT 'low',
      priority INTEGER NOT NULL DEFAULT 0,
      upvotes INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS issues_geo_idx ON issues(latitude,longitude);
    CREATE INDEX IF NOT EXISTS issues_status_idx ON issues(status);
    CREATE INDEX IF NOT EXISTS issues_category_idx ON issues(category);
    CREATE TABLE IF NOT EXISTS issue_votes(
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(issue_id,device_id)
    );
    CREATE TABLE IF NOT EXISTS issue_events(
      id BIGSERIAL PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS issue_events_issue_idx ON issue_events(issue_id,created_at);
  `);
};

const cleanText = (v, max = 5000) => String(v ?? '').trim().slice(0, max);
const validNumber = v => Number.isFinite(Number(v));
const distanceKm = (aLat,aLng,bLat,bLng) => {
  if (![aLat,aLng,bLat,bLng].every(validNumber)) return Infinity;
  const rad = Math.PI / 180, p1 = Number(aLat)*rad, p2 = Number(bLat)*rad;
  const dp = (Number(bLat)-Number(aLat))*rad, dl = (Number(bLng)-Number(aLng))*rad;
  const x = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
};
const severity = (text='') => {
  const t = text.toLowerCase();
  if (/school|hospital|accident|injur|fire|flood|collapse|exposed wire|electric shock|danger|unsafe|open manhole|sewer/.test(t)) return 'high';
  if (/pothole|leak|overflow|broken|damaged|blocked|garbage|waste|streetlight|drain/.test(t)) return 'medium';
  return 'low';
};
const priority = (sev, votes, ageDays = 0) => Math.min(100, (sev === 'high' ? 55 : sev === 'medium' ? 40 : 25) + Math.min(25, Number(votes)||0) + Math.min(10, Math.floor(Number(ageDays)||0)) + 10);
const normalize = r => ({
  id:r.id,title:r.title,category:r.category,description:r.description,locationLabel:r.location_label,
  latitude:r.latitude,longitude:r.longitude,photoUrl:r.photo_url,anonymous:r.anonymous,status:r.status,
  severity:r.severity,priority:r.priority,upvotes:r.upvotes,createdAt:r.created_at,updatedAt:r.updated_at
});
const readFallback = async () => { await ensureFallback(); return JSON.parse(await fs.readFile(fallbackFile,'utf8')); };
const writeFallback = x => fs.writeFile(fallbackFile,JSON.stringify(x,null,2));
const authAdmin = (req,res) => { if (ADMIN_KEY && req.get('x-admin-key') !== ADMIN_KEY) { res.status(401).json({error:'Admin key required'}); return false; } return true; };

app.get('/api/health', async (_req,res) => {
  let db = false;
  if (pool) { try { await pool.query('SELECT 1'); db = true; } catch {} }
  res.json({ ok:true, database:db, mode:db?'postgresql':'fallback', service:'koinos-api', time:new Date().toISOString() });
});

app.get('/api/issues', async (req,res) => {
  try {
    const lat = validNumber(req.query.lat) ? Number(req.query.lat) : null;
    const lng = validNumber(req.query.lng) ? Number(req.query.lng) : null;
    const radiusKm = Math.min(100, Math.max(0.5, Number(req.query.radiusKm)||12));
    const category = cleanText(req.query.category,30);
    const status = cleanText(req.query.status,30);
    if (pool) {
      const values=[]; const where=[];
      if (lat !== null && lng !== null) { values.push(lat,lng,radiusKm); where.push(`latitude IS NOT NULL AND longitude IS NOT NULL AND (6371*acos(LEAST(1,cos(radians($${values.length-2}))*cos(radians(latitude))*cos(radians(longitude)-radians($${values.length-1}))+sin(radians($${values.length-2}))*sin(radians(latitude))))) <= $${values.length}`); }
      if (category && category !== 'all') { values.push(category); where.push(`category=$${values.length}`); }
      if (status) { values.push(status); where.push(`status=$${values.length}`); }
      const r=await pool.query(`SELECT * FROM issues ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY priority DESC,created_at DESC LIMIT 200`,values);
      return res.json(r.rows.map(normalize));
    }
    let issues = await readFallback();
    if (lat !== null && lng !== null) issues = issues.filter(i => distanceKm(lat,lng,i.latitude,i.longitude) <= radiusKm);
    if (category && category !== 'all') issues=issues.filter(i=>i.category===category);
    if (status) issues=issues.filter(i=>i.status===status);
    res.json(issues.sort((a,b)=>(b.priority||0)-(a.priority||0)).slice(0,200));
  } catch (e) { console.error(e); res.status(500).json({error:'Unable to load civic issues'}); }
});

app.get('/api/issues/:id', async (req,res) => {
  try {
    if (pool) {
      const r=await pool.query('SELECT * FROM issues WHERE id=$1',[req.params.id]);
      if(!r.rowCount)return res.status(404).json({error:'Issue not found'});
      const e=await pool.query('SELECT status,note,created_at FROM issue_events WHERE issue_id=$1 ORDER BY created_at',[req.params.id]);
      const similar = r.rows[0].latitude != null && r.rows[0].longitude != null ? await pool.query(`SELECT id,title,category,status,priority,upvotes,latitude,longitude FROM issues WHERE id<>$1 AND latitude IS NOT NULL AND longitude IS NOT NULL AND (6371*acos(LEAST(1,cos(radians($2))*cos(radians(latitude))*cos(radians(longitude)-radians($3))+sin(radians($2))*sin(radians(latitude))))) <= 0.75 ORDER BY priority DESC LIMIT 8`,[req.params.id,r.rows[0].latitude,r.rows[0].longitude]) : {rows:[]};
      return res.json({...normalize(r.rows[0]),events:e.rows,similarIssues:similar.rows});
    }
    const issues=await readFallback(),i=issues.find(x=>x.id===req.params.id);
    if(!i)return res.status(404).json({error:'Issue not found'});
    const similar=issues.filter(x=>x.id!==i.id&&distanceKm(i.latitude,i.longitude,x.latitude,x.longitude)<=0.75).slice(0,8);
    res.json({...i,events:i.events||[],similarIssues:similar});
  } catch(e){console.error(e);res.status(500).json({error:'Unable to load issue'});}
});

app.get('/api/issues/:id/similar', async (req,res) => {
  const issueId=req.params.id;
  if(pool){
    const base=await pool.query('SELECT latitude,longitude,category FROM issues WHERE id=$1',[issueId]);
    if(!base.rowCount)return res.status(404).json({error:'Issue not found'});
    const b=base.rows[0];
    if(b.latitude==null||b.longitude==null)return res.json([]);
    const r=await pool.query(`SELECT id,title,category,status,severity,priority,upvotes,latitude,longitude,created_at FROM issues WHERE id<>$1 AND latitude IS NOT NULL AND longitude IS NOT NULL AND (6371*acos(LEAST(1,cos(radians($2))*cos(radians(latitude))*cos(radians(longitude)-radians($3))+sin(radians($2))*sin(radians(latitude))))) <= 0.75 ORDER BY priority DESC LIMIT 10`,[issueId,b.latitude,b.longitude]);
    return res.json(r.rows);
  }
  const issues=await readFallback(),base=issues.find(x=>x.id===issueId);if(!base)return res.status(404).json({error:'Issue not found'});res.json(issues.filter(x=>x.id!==issueId&&distanceKm(base.latitude,base.longitude,x.latitude,x.longitude)<=.75).slice(0,10));
});

app.post('/api/issues', async (req,res) => {
  try {
    const b=req.body||{}, description=cleanText(b.description,3000), title=cleanText(b.title||description.slice(0,70)||'Civic issue',100);
    if(!description&&!b.title)return res.status(400).json({error:'A title or description is required'});
    const lat=validNumber(b.latitude)?Number(b.latitude):null, lng=validNumber(b.longitude)?Number(b.longitude):null;
    const sev=severity(`${title} ${description}`), id=crypto.randomUUID();
    // Server-side proximity check turns repeated complaints into a discoverable community cluster.
    let similar=[];
    if(pool && lat!==null && lng!==null){
      const r=await pool.query(`SELECT id,title,category,status,priority,upvotes,latitude,longitude FROM issues WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status<>'resolved' AND (6371*acos(LEAST(1,cos(radians($1))*cos(radians(latitude))*cos(radians(longitude)-radians($2))+sin(radians($1))*sin(radians(latitude))))) <= 0.35 ORDER BY priority DESC LIMIT 8`,[lat,lng]);
      similar=r.rows;
    } else if(!pool && lat!==null && lng!==null){
      const all=await readFallback();similar=all.filter(x=>x.status!=='resolved'&&distanceKm(lat,lng,x.latitude,x.longitude)<=.35).sort((a,b)=>(b.priority||0)-(a.priority||0)).slice(0,8);
    }
    const p=priority(sev,0,0);
    const base={id,title,category:cleanText(b.category,30)||'other',description,locationLabel:cleanText(b.locationLabel,180)||null,latitude:lat,longitude:lng,photoUrl:cleanText(b.photoUrl,200000)||null,anonymous:Boolean(b.anonymous),status:'reported',severity:sev,priority:p,upvotes:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    if(pool){
      const r=await pool.query(`INSERT INTO issues(id,title,category,description,location_label,latitude,longitude,photo_url,anonymous,status,severity,priority) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'reported',$10,$11) RETURNING *`,[id,title,base.category,description,base.locationLabel,lat,lng,base.photoUrl,base.anonymous,sev,p]);
      await pool.query(`INSERT INTO issue_events(issue_id,status,note) VALUES($1,'reported',$2)`,[id,similar.length?`Report received. ${similar.length} nearby active issue(s) may be related.`:'Report received']);
      return res.status(201).json({...normalize(r.rows[0]),similarIssues:similar,communityMatch:Boolean(similar.length)});
    }
    const issues=await readFallback();issues.push({...base,events:[{status:'reported',note:'Report received',createdAt:base.createdAt}]});await writeFallback(issues);res.status(201).json({...base,similarIssues:similar,communityMatch:Boolean(similar.length)});
  } catch(e){console.error(e);res.status(500).json({error:'Could not save report'});}
});

app.post('/api/issues/:id/upvote',async(req,res)=>{
  const device=cleanText(req.get('x-device-id'),120);if(!device)return res.status(400).json({error:'X-Device-ID required'});
  try{
    if(pool){
      const v=await pool.query('INSERT INTO issue_votes(issue_id,device_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING issue_id',[req.params.id,device]);
      if(!v.rowCount){const r=await pool.query('SELECT * FROM issues WHERE id=$1',[req.params.id]);return r.rowCount?res.status(409).json({...normalize(r.rows[0]),alreadyVoted:true}):res.status(404).json({error:'Issue not found'});}
      const r=await pool.query('UPDATE issues SET upvotes=upvotes+1,priority=LEAST(100,priority+1),updated_at=NOW() WHERE id=$1 RETURNING *',[req.params.id]);
      return res.json(normalize(r.rows[0]));
    }
    const issues=await readFallback(),i=issues.find(x=>x.id===req.params.id);if(!i)return res.status(404).json({error:'Issue not found'});i.upvotes=(i.upvotes||0)+1;i.priority=Math.min(100,(i.priority||0)+1);i.updatedAt=new Date().toISOString();await writeFallback(issues);res.json(i);
  }catch(e){console.error(e);res.status(500).json({error:'Could not record support'});}
});

app.patch('/api/issues/:id/status',async(req,res)=>{
  if(!authAdmin(req,res))return;
  const status=req.body?.status,allowed=['reported','in_progress','resolved'];
  if(!allowed.includes(status))return res.status(400).json({error:`status must be one of ${allowed.join(', ')}`});
  try{
    if(pool){const r=await pool.query('UPDATE issues SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[status,req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Issue not found'});await pool.query('INSERT INTO issue_events(issue_id,status,note) VALUES($1,$2,$3)',[req.params.id,status,cleanText(req.body.note,500)||null]);return res.json(normalize(r.rows[0]));}
    const issues=await readFallback(),i=issues.find(x=>x.id===req.params.id);if(!i)return res.status(404).json({error:'Issue not found'});i.status=status;i.updatedAt=new Date().toISOString();i.events=[...(i.events||[]),{status,note:cleanText(req.body.note,500)||null,createdAt:i.updatedAt}];await writeFallback(issues);res.json(i);
  }catch(e){console.error(e);res.status(500).json({error:'Could not update status'});}
});

app.post('/api/issues/:id/verify',async(req,res)=>{
  const verdict=req.body?.verdict;
  if(!['fixed','still_open'].includes(verdict))return res.status(400).json({error:'verdict must be fixed or still_open'});
  try{
    if(pool){
      const r=await pool.query('SELECT * FROM issues WHERE id=$1',[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Issue not found'});
      if(verdict==='fixed') await pool.query("UPDATE issues SET status='resolved',updated_at=NOW() WHERE id=$1",[req.params.id]);
      await pool.query('INSERT INTO issue_events(issue_id,status,note) VALUES($1,$2,$3)',[req.params.id,verdict==='fixed'?'resolved':'reported',verdict==='fixed'?'Community verification: fixed':'Community verification: still open']);
      const updated=await pool.query('SELECT * FROM issues WHERE id=$1',[req.params.id]);return res.json({...normalize(updated.rows[0]),verified:verdict==='fixed'});
    }
    const issues=await readFallback(),i=issues.find(x=>x.id===req.params.id);if(!i)return res.status(404).json({error:'Issue not found'});if(verdict==='fixed')i.status='resolved';i.updatedAt=new Date().toISOString();i.events=[...(i.events||[]),{status:i.status,note:verdict==='fixed'?'Community verification: fixed':'Community verification: still open',createdAt:i.updatedAt}];await writeFallback(issues);res.json({...i,verified:verdict==='fixed'});
  }catch(e){console.error(e);res.status(500).json({error:'Could not record verification'});}
});

app.get('/api/analytics',async(_req,res)=>{
  try{
    if(pool){
      const r=await pool.query(`SELECT COUNT(*) total,COUNT(*) FILTER(WHERE status='resolved') resolved,COUNT(*) FILTER(WHERE status='in_progress') in_progress,COUNT(*) FILTER(WHERE severity='high') critical,COALESCE(SUM(upvotes),0) supporters FROM issues`),x=r.rows[0];
      const c=await pool.query('SELECT category,COUNT(*) count FROM issues GROUP BY category ORDER BY count DESC');
      return res.json({totalReports:Number(x.total),resolved:Number(x.resolved),inProgress:Number(x.in_progress),critical:Number(x.critical),supporters:Number(x.supporters),resolutionRate:x.total?Math.round(Number(x.resolved)/Number(x.total)*100):0,byCategory:c.rows});
    }
    const i=await readFallback(),resolved=i.filter(x=>x.status==='resolved').length;res.json({totalReports:i.length,resolved,inProgress:i.filter(x=>x.status==='in_progress').length,critical:i.filter(x=>x.severity==='high').length,supporters:i.reduce((n,x)=>n+(x.upvotes||0),0),resolutionRate:i.length?Math.round(resolved/i.length*100):0});
  }catch(e){console.error(e);res.status(500).json({error:'Unable to load analytics'});}
});

app.get('/api/admin/issues',async(req,res)=>{
  if(!authAdmin(req,res))return;
  if(pool){const r=await pool.query('SELECT * FROM issues ORDER BY priority DESC,created_at DESC LIMIT 500');return res.json(r.rows.map(normalize));}
  res.json((await readFallback()).sort((a,b)=>(b.priority||0)-(a.priority||0)));
});

app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Unexpected server error'});});
await initDb();
app.listen(PORT,()=>console.log(`KOINOS API listening on ${PORT} — ${pool?'PostgreSQL':'local fallback'}`));
