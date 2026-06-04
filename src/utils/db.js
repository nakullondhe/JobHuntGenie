import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title       TEXT NOT NULL,
      company     TEXT,
      location    TEXT,
      url         TEXT,
      description TEXT,
      source      TEXT,
      keyword     TEXT,
      status      TEXT DEFAULT 'new',
      keywords    JSONB DEFAULT '[]',
      match_score INTEGER DEFAULT 0,
      resume_pdf  BYTEA,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS applications (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id      UUID,
      resume_path TEXT,
      applied_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      blob       BYTEA,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('[DB] Schema ready');
}

function formatJob(row) {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    url: row.url,
    description: row.description,
    source: row.source,
    keyword: row.keyword,
    status: row.status,
    keywords: row.keywords || [],
    matchScore: row.match_score,
    hasResume: !!row.resume_pdf,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class JobsDB {
  async getAll() {
    const { rows } = await pool.query(
      'SELECT id,title,company,location,url,description,source,keyword,status,keywords,match_score,created_at,updated_at,(resume_pdf IS NOT NULL) AS has_resume FROM jobs ORDER BY created_at DESC'
    );
    return rows.map(r => ({ ...formatJob(r), hasResume: r.has_resume }));
  }

  async add(job) {
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO jobs (id,title,company,location,url,description,source,keyword,status,keywords,match_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'new',$9,$10) RETURNING *`,
      [id, job.title, job.company, job.location, job.url, job.description,
       job.source, job.keyword, JSON.stringify(job.keywords || []), job.matchScore || 0]
    );
    return formatJob(rows[0]);
  }

  async update(jobId, updates) {
    const fields = [];
    const values = [];
    let i = 1;

    if (updates.status !== undefined)    { fields.push(`status=$${i++}`);     values.push(updates.status); }
    if (updates.resumePdf !== undefined) { fields.push(`resume_pdf=$${i++}`); values.push(updates.resumePdf); }
    if (updates.keywords !== undefined)  { fields.push(`keywords=$${i++}`);   values.push(JSON.stringify(updates.keywords)); }
    if (updates.matchScore !== undefined){ fields.push(`match_score=$${i++}`);values.push(updates.matchScore); }

    if (!fields.length) return this.getById(jobId);
    fields.push('updated_at=NOW()');
    values.push(jobId);

    const { rows } = await pool.query(
      `UPDATE jobs SET ${fields.join(',')} WHERE id=$${i} RETURNING *`,
      values
    );
    return rows[0] ? formatJob(rows[0]) : null;
  }

  async getById(jobId) {
    const { rows } = await pool.query('SELECT * FROM jobs WHERE id=$1', [jobId]);
    return rows[0] ? formatJob(rows[0]) : null;
  }

  async getByStatus(status) {
    const { rows } = await pool.query(
      'SELECT id,title,company,location,url,description,source,keyword,status,keywords,match_score,created_at,updated_at FROM jobs WHERE status=$1 ORDER BY created_at DESC',
      [status]
    );
    return rows.map(formatJob);
  }

  async getNew() {
    return this.getByStatus('new');
  }

  async removeExisting(newJobs) {
    const { rows } = await pool.query('SELECT url,title,company FROM jobs');
    const existingUrls = new Set(rows.map(r => r.url).filter(Boolean));
    const existingKeys = new Set(rows.map(r => `${r.title}|${r.company}`.toLowerCase()));
    return newJobs.filter(job => {
      if (job.url && existingUrls.has(job.url)) return false;
      if (existingKeys.has(`${job.title}|${job.company}`.toLowerCase())) return false;
      return true;
    });
  }
}

export class ApplicationsDB {
  async getAll() {
    const { rows } = await pool.query('SELECT * FROM applications ORDER BY applied_at DESC');
    return rows;
  }

  async add(jobId, resumePath) {
    const { rows } = await pool.query(
      'INSERT INTO applications (id,job_id,resume_path) VALUES ($1,$2,$3) RETURNING *',
      [uuidv4(), jobId, resumePath]
    );
    return rows[0];
  }

  async getByJobId(jobId) {
    const { rows } = await pool.query('SELECT * FROM applications WHERE job_id=$1', [jobId]);
    return rows;
  }
}

export class SettingsDB {
  async get(key) {
    const { rows } = await pool.query('SELECT * FROM settings WHERE key=$1', [key]);
    return rows[0] || null;
  }

  async set(key, value, blob = null) {
    await pool.query(
      `INSERT INTO settings (key,value,blob,updated_at) VALUES ($1,$2,$3,NOW())
       ON CONFLICT (key) DO UPDATE SET value=$2, blob=$3, updated_at=NOW()`,
      [key, value, blob]
    );
  }
}
