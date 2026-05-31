import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import config from './config.js';
import { JobsDB, ApplicationsDB } from './utils/db.js';
import { JobScraper } from './scrapers/jobScraper.js';
import { ResumeTailor, ResumeKeywordExtractor } from './resume/tailor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const app = express();
const jobsDb = new JobsDB();
const appsDb = new ApplicationsDB();
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

app.get('/api/stats', (req, res) => {
  const jobs = jobsDb.getAll();
  const newJobs = jobs.filter(j => j.status === 'new').length;
  const applied = jobs.filter(j => j.status === 'applied').length;
  const generated = jobs.filter(j => j.status === 'resume_generated').length;
  const scores = jobs.map(j => j.matchScore).filter(s => typeof s === 'number');
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  res.json({
    success: true,
    stats: {
      totalJobs: jobs.length,
      newJobs,
      generated,
      applied,
      avgScore,
    },
  });
});

// ── Job Management ────────────────────────────────────────────────────────────

app.get('/api/jobs', (req, res) => {
  const { status } = req.query;
  const jobs = status ? jobsDb.getByStatus(status) : jobsDb.getAll();
  res.json({ success: true, jobs, count: jobs.length });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobsDb.getById(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  res.json({ success: true, job });
});

app.put('/api/jobs/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['new', 'resume_generated', 'applied', 'archived'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: `Invalid status. Use: ${validStatuses.join(', ')}` });
  }
  const job = jobsDb.update(req.params.id, { status });
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  res.json({ success: true, job });
});

// ── Resume ────────────────────────────────────────────────────────────────────

app.post('/api/jobs/:id/generate-resume', async (req, res) => {
  const job = jobsDb.getById(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

  try {
    const result = await tailor.createTailoredResume(
      job.id,
      job.title,
      job.description || '',
      config.resumePath,
      config.resumeOutputDir
    );

    jobsDb.update(job.id, {
      status: 'resume_generated',
      resumePath: result.path,
      keywords: result.keywords,
    });

    res.json({
      success: true,
      resumePath: result.path,
      keywords: result.keywords,
      message: `Resume generated for "${job.title}"`,
    });
  } catch (err) {
    console.error('[generate-resume]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/download-resume/:id', (req, res) => {
  const job = jobsDb.getById(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  if (!job.resumePath || !fs.existsSync(job.resumePath)) {
    return res.status(404).json({ success: false, error: 'Resume not generated yet' });
  }
  res.download(job.resumePath);
});

// ── Search ────────────────────────────────────────────────────────────────────

app.post('/api/scrape', async (req, res) => {
  const keywords = req.body.keywords || config.targetJobs;
  try {
    const rawJobs = await scraper.scrapeAll(keywords);
    const newJobs = jobsDb.removeExisting(rawJobs);

    const addedJobs = newJobs.map(job => {
      const keywords = extractor.extractKeywords(job.description || '');
      const matchScore = extractor.calculateMatchScore(
        job.description || '',
        keywords
      );
      return jobsDb.add({ ...job, keywords, matchScore });
    });

    res.json({
      success: true,
      scraped: rawJobs.length,
      added: addedJobs.length,
      jobs: addedJobs,
    });
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

app.listen(config.port, () => {
  console.log(`\n🚀 JobHuntGenie server running on http://localhost:${config.port}`);
  console.log(`📊 Dashboard: http://localhost:${config.port}`);
  console.log(`💚 Health:    http://localhost:${config.port}/api/health\n`);
});

export default app;
