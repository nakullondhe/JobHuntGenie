import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import config from '../config.js';

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export class JobsDB {
  getAll() {
    return readJson(config.jobsDb);
  }

  add(job) {
    const jobs = this.getAll();
    const newJob = {
      ...job,
      id: uuidv4(),
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    jobs.push(newJob);
    writeJson(config.jobsDb, jobs);
    return newJob;
  }

  update(jobId, updates) {
    const jobs = this.getAll();
    const idx = jobs.findIndex(j => j.id === jobId);
    if (idx === -1) return null;
    jobs[idx] = { ...jobs[idx], ...updates, updatedAt: new Date().toISOString() };
    writeJson(config.jobsDb, jobs);
    return jobs[idx];
  }

  getById(jobId) {
    return this.getAll().find(j => j.id === jobId) || null;
  }

  getByStatus(status) {
    return this.getAll().filter(j => j.status === status);
  }

  getNew() {
    return this.getByStatus('new');
  }

  removeExisting(newJobs) {
    const existing = this.getAll();
    const existingUrls = new Set(existing.map(j => j.url).filter(Boolean));
    const existingTitles = new Set(
      existing.map(j => `${j.title}|${j.company}`.toLowerCase())
    );
    return newJobs.filter(job => {
      if (job.url && existingUrls.has(job.url)) return false;
      if (existingTitles.has(`${job.title}|${job.company}`.toLowerCase())) return false;
      return true;
    });
  }
}

export class ApplicationsDB {
  getAll() {
    return readJson(config.applicationsDb);
  }

  add(jobId, resumePath) {
    const apps = this.getAll();
    const app = {
      id: uuidv4(),
      jobId,
      resumePath,
      appliedAt: new Date().toISOString(),
    };
    apps.push(app);
    writeJson(config.applicationsDb, apps);
    return app;
  }

  getByJobId(jobId) {
    return this.getAll().filter(a => a.jobId === jobId);
  }
}
