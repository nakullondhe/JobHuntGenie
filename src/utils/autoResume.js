import fs from 'fs';
import path from 'path';
import config from '../config.js';
import { JobsDB, SettingsDB } from './db.js';
import { ResumeTailor } from '../resume/tailor.js';

const jobsDb = new JobsDB();
const settingsDb = new SettingsDB();
const tailor = new ResumeTailor();

export async function generateResumesForJobs(jobs) {
  if (!jobs || !jobs.length) return;

  // Get base resume from DB or fall back to configured path
  let baseResumePath = config.resumePath;
  try {
    const resumeSetting = await settingsDb.get('base_resume');
    if (resumeSetting?.blob) {
      baseResumePath = '/tmp/base_resume.pdf';
      fs.writeFileSync(baseResumePath, resumeSetting.blob);
    }
  } catch (err) {
    console.warn('[auto-resume] Could not load base resume from DB:', err.message);
  }

  console.log(`[auto-resume] Generating resumes for ${jobs.length} job(s)...`);
  for (const job of jobs) {
    try {
      const result = await tailor.createTailoredResume(
        job.id, job.title, job.description || '',
        baseResumePath, '/tmp/resumes'
      );
      const pdfBytes = fs.readFileSync(result.path);
      await jobsDb.update(job.id, {
        status: 'resume_generated',
        resumePdf: pdfBytes,
        keywords: result.keywords,
      });
      try { fs.rmSync(path.dirname(result.path), { recursive: true, force: true }); } catch {}
      console.log(`[auto-resume] Done: ${job.title} @ ${job.company}`);
    } catch (err) {
      console.error(`[auto-resume] Failed for "${job.title}": ${err.message}`);
    }
  }
}
