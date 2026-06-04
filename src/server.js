import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import config from './config.js';
import { initSchema, JobsDB, ApplicationsDB, SettingsDB, pool } from './utils/db.js';
import { JobScraper } from './scrapers/jobScraper.js';
import { ResumeTailor, ResumeKeywordExtractor } from './resume/tailor.js';
import { generateResumesForJobs } from './utils/autoResume.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const jobsDb = new JobsDB();
const appsDb = new ApplicationsDB();
const settingsDb = new SettingsDB();
const scraper = new JobScraper();
const tailor = new ResumeTailor();
const extractor = new ResumeKeywordExtractor();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(root, 'public')));

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ success: true, version: '1.0.0', timestamp: new Date().toISOString() });
});

app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    config: {
      port: config.port,
      nodeEnv: config.nodeEnv,
      salaryRange: config.salaryRange,
      targetJobs: config.targetJobs,
      scrapeSchedule: config.scrapeSchedule,
      scraping: config.scraping,
    },
  });
});

app.get('/api/stats', async (req, res) => {
  try {
    const jobs = await jobsDb.getAll();
    const newJobs = jobs.filter(j => j.status === 'new').length;
    const applied = jobs.filter(j => j.status === 'applied').length;
    const generated = jobs.filter(j => j.status === 'resume_generated').length;
    const scores = jobs.map(j => j.matchScore).filter(s => typeof s === 'number');
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    res.json({ success: true, stats: { totalJobs: jobs.length, newJobs, generated, applied, avgScore } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Resume Upload ─────────────────────────────────────────────────────────────

app.post('/api/upload-resume', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file provided' });
  if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ success: false, error: 'Only PDF files are accepted' });
  }
  try {
    await settingsDb.set('base_resume', req.file.originalname, req.file.buffer);
    res.json({ success: true, message: 'Resume uploaded successfully', filename: req.file.originalname });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/has-resume', async (req, res) => {
  try {
    const setting = await settingsDb.get('base_resume');
    res.json({ success: true, hasResume: !!(setting && setting.blob), filename: setting?.value || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Job Management ────────────────────────────────────────────────────────────

app.get('/api/jobs', async (req, res) => {
  try {
    const { status } = req.query;
    const jobs = status ? await jobsDb.getByStatus(status) : await jobsDb.getAll();
    res.json({ success: true, jobs, count: jobs.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await jobsDb.getById(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/jobs/:id/status', async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['new', 'resume_generated', 'applied', 'archived'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: `Invalid status. Use: ${validStatuses.join(', ')}` });
  }
  try {
    const job = await jobsDb.update(req.params.id, { status });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Resume Generation ─────────────────────────────────────────────────────────

app.post('/api/jobs/:id/generate-resume', async (req, res) => {
  try {
    const job = await jobsDb.getById(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    // Write base resume to /tmp if stored in DB, otherwise use configured path
    let baseResumePath = config.resumePath;
    const resumeSetting = await settingsDb.get('base_resume');
    if (resumeSetting?.blob) {
      baseResumePath = '/tmp/base_resume.pdf';
      fs.writeFileSync(baseResumePath, resumeSetting.blob);
    }

    const tmpOutputDir = '/tmp/resumes';
    const result = await tailor.createTailoredResume(
      job.id, job.title, job.description || '',
      baseResumePath, tmpOutputDir
    );

    // Store PDF bytes in DB
    const pdfBytes = fs.readFileSync(result.path);
    await jobsDb.update(job.id, {
      status: 'resume_generated',
      resumePdf: pdfBytes,
      keywords: result.keywords,
    });

    // Clean up tmp
    try { fs.rmSync(path.dirname(result.path), { recursive: true, force: true }); } catch {}

    res.json({
      success: true,
      keywords: result.keywords,
      message: `Resume generated for "${job.title}"`,
    });
  } catch (err) {
    console.error('[generate-resume]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/download-resume/:id', async (req, res) => {
  try {
    const job = await jobsDb.getById(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    const { rows } = await pool.query('SELECT resume_pdf FROM jobs WHERE id=$1', [req.params.id]);
    if (!rows[0]?.resume_pdf) {
      return res.status(404).json({ success: false, error: 'Resume not generated yet' });
    }

    const safeTitle = job.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 50);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Resume_${safeTitle}.pdf"`);
    res.send(rows[0].resume_pdf);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Search ────────────────────────────────────────────────────────────────────

app.post('/api/scrape', async (req, res) => {
  const keywords = req.body.keywords || config.targetJobs;
  try {
    const rawJobs = await scraper.scrapeAll(keywords);
    const newJobs = await jobsDb.removeExisting(rawJobs);

    const addedJobs = await Promise.all(
      newJobs.map(job => {
        const kws = extractor.extractKeywords(job.description || '');
        const matchScore = extractor.calculateMatchScore(job.description || '', kws);
        return jobsDb.add({ ...job, keywords: kws, matchScore });
      })
    );

    // Respond immediately, then auto-generate resumes in background
    res.json({ success: true, scraped: rawJobs.length, added: addedJobs.length, jobs: addedJobs });
    generateResumesForJobs(addedJobs).catch(err =>
      console.error('[auto-resume background]', err.message)
    );
  } catch (err) {
    console.error('[scrape]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Error Handlers ────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

app.use((err, req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

await initSchema();

app.listen(config.port, () => {
  console.log(`\n🚀 JobHuntGenie server running on http://localhost:${config.port}`);
  console.log(`📊 Dashboard: http://localhost:${config.port}`);
  console.log(`💚 Health:    http://localhost:${config.port}/api/health\n`);
});

export default app;
