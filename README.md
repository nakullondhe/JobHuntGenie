# JobHuntGenie

> Automated job search with tailored resume generation — find jobs on Dice & Indeed, score them against your skills, and produce a tailored PDF in one click.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your salary range & target job titles

# 3. Add your resume
cp /path/to/Your_Resume.pdf ./resume/Resume.pdf

# 4. Start the server
npm start

# 5. Open dashboard
open http://localhost:5000
```

## Features

- **Multi-board scraping** — Dice and Indeed (LinkedIn blocked by bot detection)
- **Keyword extraction** — matches 15+ tech-skill categories against job descriptions
- **Match scoring** — 0-100% compatibility score per job
- **Resume tailoring** — copies your base PDF, injects job-specific metadata and keywords
- **Dashboard UI** — filter, review, generate resumes, track application status
- **Scheduler** — daily cron job (configurable) to auto-search new postings

## Architecture

```
JobHuntGenie/
├── src/
│   ├── config.js          # Centralised env config
│   ├── server.js          # Express REST API
│   ├── scheduler.js       # node-cron daily search
│   ├── scrapers/
│   │   └── jobScraper.js  # Dice, Indeed, LinkedIn scrapers
│   ├── resume/
│   │   └── tailor.js      # PDF tailoring & keyword extraction
│   ├── utils/
│   │   └── db.js          # JSON file-based storage
│   └── dashboard/
│       ├── Dashboard.jsx  # React SPA
│       └── Dashboard.css
├── public/
│   └── index.html
├── data/                  # jobs.json, applications.json (git-ignored)
├── resume/                # Input PDF (git-ignored)
└── resumes_output/        # Generated PDFs (git-ignored)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health & version |
| GET | `/api/config` | Active configuration |
| GET | `/api/stats` | Job counts & avg match score |
| GET | `/api/jobs` | All jobs (optional `?status=new`) |
| GET | `/api/jobs/:id` | Single job |
| PUT | `/api/jobs/:id/status` | Update job status |
| POST | `/api/jobs/:id/generate-resume` | Generate tailored PDF |
| GET | `/api/download-resume/:id` | Download generated PDF |
| POST | `/api/scrape` | Trigger job search |

### Job Status Flow

```
new -> resume_generated -> applied -> archived
```

## Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `MIN_SALARY_USD` | `150000` | Minimum USD salary filter |
| `MAX_SALARY_USD` | `300000` | Maximum USD salary filter |
| `TARGET_JOBS` | `SWE-2,Senior Backend Engineer,...` | Comma-separated job titles |
| `RESUME_INPUT_PATH` | `./resume/Resume.pdf` | Source resume PDF |
| `SCRAPE_SCHEDULE` | `0 9 * * *` | Cron schedule for auto-search |
| `SCRAPE_DICE` | `1` | Enable Dice scraping |
| `SCRAPE_INDEED` | `1` | Enable Indeed scraping |
| `SCRAPE_LINKEDIN` | `0` | Enable LinkedIn (bot-blocked) |

## Troubleshooting

**No jobs found after scraping**
Job boards frequently update their HTML structure. Check the browser version of the site and update the CSS selectors in `src/scrapers/jobScraper.js`.

**Resume generation fails**
Ensure `./resume/Resume.pdf` exists, or the system will generate a placeholder PDF until you add your real resume.

**Dashboard shows blank page**
The React dashboard requires a bundler (Webpack/Vite). For development, serve the API separately and use a dev server for the frontend, or build `bundle.js` with a bundler of your choice.

## Deployment

```bash
# Set NODE_ENV=production in .env
# Use pm2 for process management
npm install -g pm2
pm2 start src/server.js --name jobhuntgenie
pm2 start src/scheduler.js --name jobhuntgenie-scheduler
pm2 save
```
