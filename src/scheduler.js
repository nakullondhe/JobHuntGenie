import cron from 'node-cron';
import config from './config.js';
import { JobsDB } from './utils/db.js';
import { JobScraper } from './scrapers/jobScraper.js';
import { ResumeKeywordExtractor } from './resume/tailor.js';

const jobsDb = new JobsDB();
const scraper = new JobScraper();
const extractor = new ResumeKeywordExtractor();

export async function triggerSearch(keywords) {
  const searchKeywords = keywords || config.targetJobs;
  console.log(`[Scheduler] Running search for: ${searchKeywords.join(', ')}`);

  const rawJobs = await scraper.scrapeAll(searchKeywords);
  const newJobs = jobsDb.removeExisting(rawJobs);

  const addedJobs = newJobs.map(job => {
    const kws = extractor.extractKeywords(job.description || '');
    const matchScore = extractor.calculateMatchScore(job.description || '', kws);
    return jobsDb.add({ ...job, keywords: kws, matchScore });
  });

  console.log(`[Scheduler] Scraped: ${rawJobs.length}, New: ${addedJobs.length}`);
  return { scraped: rawJobs.length, added: addedJobs.length, jobs: addedJobs };
}

const task = cron.schedule(config.scrapeSchedule, async () => {
  console.log(`[Scheduler] Cron triggered at ${new Date().toISOString()}`);
  try {
    await triggerSearch();
  } catch (err) {
    console.error('[Scheduler] Error during scheduled search:', err.message);
  }
});

process.on('SIGINT', () => {
  console.log('\n[Scheduler] Shutting down gracefully...');
  task.stop();
  process.exit(0);
});

console.log(`[Scheduler] Running. Next search scheduled: ${config.scrapeSchedule}`);
