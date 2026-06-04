import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  salaryRange: {
    usd: {
      min: parseInt(process.env.MIN_SALARY_USD || '150000', 10),
      max: parseInt(process.env.MAX_SALARY_USD || '300000', 10),
    },
    inr: {
      min: parseInt(process.env.MIN_SALARY_INR || '3000000', 10),
      max: parseInt(process.env.MAX_SALARY_INR || '6000000', 10),
    },
  },

  targetJobs: (process.env.TARGET_JOBS || 'Software Engineer 2,Senior Software Engineer,Senior Backend Engineer,Full Stack Engineer,Node.js Engineer,React Engineer,Ruby on Rails Engineer,Frontend Engineer,TypeScript Engineer,Backend Developer,Frontend Developer,Software Engineer')
    .split(',')
    .map(j => j.trim()),

  resumePath: path.resolve(root, process.env.RESUME_INPUT_PATH || './resume/Resume.pdf'),
  resumeOutputDir: path.resolve(root, process.env.RESUME_OUTPUT_DIR || './resumes_output'),

  scrapeSchedule: process.env.SCRAPE_SCHEDULE || '0 9 * * *',

  scraping: {
    dice:      process.env.SCRAPE_DICE !== '0',
    indeed:    process.env.SCRAPE_INDEED !== '0',
    glassdoor: process.env.SCRAPE_GLASSDOOR !== '0',
    wwr:       process.env.SCRAPE_WWR !== '0',
    remoteco:  process.env.SCRAPE_REMOTECO !== '0',
    linkedin:  process.env.SCRAPE_LINKEDIN === '1',
  },

  dataDir: path.resolve(root, 'data'),
  jobsDb: path.resolve(root, 'data', 'jobs.json'),
  applicationsDb: path.resolve(root, 'data', 'applications.json'),
};

export default config;
