import pg from 'pg';

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.log('KOINOS migration: no DATABASE_URL, using fallback storage.');
  process.exit(0);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

try {
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

    ALTER TABLE issues ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS location_label TEXT;
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS photo_url TEXT;
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS anonymous BOOLEAN DEFAULT false;
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'reported';
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'low';
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0;
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    ALTER TABLE issues ALTER COLUMN category SET DEFAULT 'other';
    ALTER TABLE issues ALTER COLUMN description SET DEFAULT '';
    ALTER TABLE issues ALTER COLUMN anonymous SET DEFAULT false;
    ALTER TABLE issues ALTER COLUMN status SET DEFAULT 'reported';
    ALTER TABLE issues ALTER COLUMN severity SET DEFAULT 'low';
    ALTER TABLE issues ALTER COLUMN priority SET DEFAULT 0;
    ALTER TABLE issues ALTER COLUMN upvotes SET DEFAULT 0;

    UPDATE issues SET category='other' WHERE category IS NULL;
    UPDATE issues SET description='' WHERE description IS NULL;
    UPDATE issues SET anonymous=false WHERE anonymous IS NULL;
    UPDATE issues SET status='reported' WHERE status IS NULL;
    UPDATE issues SET severity='low' WHERE severity IS NULL;
    UPDATE issues SET priority=0 WHERE priority IS NULL;
    UPDATE issues SET upvotes=0 WHERE upvotes IS NULL;
    UPDATE issues SET created_at=NOW() WHERE created_at IS NULL;
    UPDATE issues SET updated_at=NOW() WHERE updated_at IS NULL;

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
  console.log('KOINOS migration: database schema ready.');
} catch (error) {
  console.error('KOINOS migration failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
