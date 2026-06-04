import axios from 'axios';
import * as cheerio from 'cheerio';
import config from '../config.js';

const REQUEST_TIMEOUT = 12000;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

// Fetch with timeout + error handling
async function fetchHtml(url) {
  const { data } = await axios.get(url, { headers: HEADERS, timeout: REQUEST_TIMEOUT });
  return data;
}

// ── Salary filter helper ──────────────────────────────────────────────────────
// Returns true if the salary text contains a value >= minSalary (USD)
function salaryMeetsMinimum(salaryText, minSalaryK) {
  if (!salaryText) return true; // no salary shown → include (filter later manually)
  const text = salaryText.replace(/,/g, '');
  const numbers = text.match(/\d+/g);
  if (!numbers) return true;
  // Convert to K for comparison
  const values = numbers.map(n => {
    const v = parseInt(n, 10);
    // If value looks like a full salary (>1000), convert to K
    return v > 1000 ? Math.floor(v / 1000) : v;
  });
  return values.some(v => v >= minSalaryK);
}

// ── Dice ──────────────────────────────────────────────────────────────────────

export class DiceScraper {
  async search(keywords, minSalary = 0) {
    const jobs = [];
    const minK = Math.floor(minSalary / 1000);

    for (const keyword of keywords) {
      try {
        const url = `https://www.dice.com/jobs?q=${encodeURIComponent(keyword)}&countryCode=US&radius=30&radiusUnit=mi&page=1&pageSize=20&filters.employmentType=FULLTIME&language=en`;
        const data = await fetchHtml(url);
        const $ = cheerio.load(data);

        $('dhi-search-card, [data-cy="search-card"]').each((_, el) => {
          const title    = $(el).find('[data-cy="card-title"], .card-title').text().trim();
          const company  = $(el).find('[data-cy="card-company"], .card-company').text().trim();
          const location = $(el).find('[data-cy="card-location"], .card-location').text().trim();
          const salary   = $(el).find('[data-cy="card-salary"], .card-salary').text().trim();
          const link     = $(el).find('a[data-cy="card-title-link"], a.card-title-link').attr('href');
          const summary  = $(el).find('[data-cy="card-summary"], .card-description').text().trim();

          if (title && salaryMeetsMinimum(salary, minK)) {
            jobs.push({
              title, company: company || 'Unknown', location: location || 'Remote',
              url: link ? (link.startsWith('http') ? link : `https://www.dice.com${link}`) : null,
              description: summary, salary, source: 'dice', keyword,
            });
          }
        });
      } catch (err) {
        console.warn(`[Dice] "${keyword}": ${err.message}`);
      }
    }
    return jobs;
  }
}

// ── Indeed ────────────────────────────────────────────────────────────────────

export class IndeedScraper {
  async search(keywords, minSalary = 0) {
    const jobs = [];
    const minK = Math.floor(minSalary / 1000);

    for (const keyword of keywords) {
      try {
        const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(keyword + ' $' + minK + 'k')}&l=United+States&sort=date&limit=20`;
        const data = await fetchHtml(url);
        const $ = cheerio.load(data);

        $('div.job_seen_beacon, .jobsearch-SerpJobCard, [data-jk]').each((_, el) => {
          const title    = $(el).find('h2.jobTitle span, .jobtitle').first().text().trim();
          const company  = $(el).find('[data-testid="company-name"], .companyName').first().text().trim();
          const location = $(el).find('[data-testid="text-location"], .companyLocation').first().text().trim();
          const salary   = $(el).find('[data-testid="attribute_snippet_testid"], .salary-snippet').text().trim();
          const jobKey   = $(el).attr('data-jk');
          const summary  = $(el).find('.job-snippet, .summary').text().trim();

          if (title && salaryMeetsMinimum(salary, minK)) {
            jobs.push({
              title, company: company || 'Unknown', location: location || 'Remote',
              url: jobKey ? `https://www.indeed.com/viewjob?jk=${jobKey}` : null,
              description: summary, salary, source: 'indeed', keyword,
            });
          }
        });
      } catch (err) {
        console.warn(`[Indeed] "${keyword}": ${err.message}`);
      }
    }
    return jobs;
  }
}

// ── Glassdoor ─────────────────────────────────────────────────────────────────

export class GlassdoorScraper {
  async search(keywords, minSalary = 0) {
    const jobs = [];
    const minK = Math.floor(minSalary / 1000);

    for (const keyword of keywords) {
      try {
        const url = `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodeURIComponent(keyword)}&locT=N&locId=1&jobType=fulltime&minSalary=${minSalary}`;
        const data = await fetchHtml(url);
        const $ = cheerio.load(data);

        $('[data-test="jobListing"], .react-job-listing').each((_, el) => {
          const title    = $(el).find('[data-test="job-title"], .job-title').first().text().trim();
          const company  = $(el).find('[data-test="employer-name"], .employer-name').first().text().trim();
          const location = $(el).find('[data-test="emp-location"], .location').first().text().trim();
          const salary   = $(el).find('[data-test="detailSalary"], .salary-estimate').text().trim();
          const link     = $(el).find('a[data-test="job-title"]').attr('href') || $(el).find('a').first().attr('href');

          if (title && salaryMeetsMinimum(salary, minK)) {
            jobs.push({
              title, company: company || 'Unknown', location: location || 'Remote',
              url: link ? (link.startsWith('http') ? link : `https://www.glassdoor.com${link}`) : null,
              description: '', salary, source: 'glassdoor', keyword,
            });
          }
        });
      } catch (err) {
        console.warn(`[Glassdoor] "${keyword}": ${err.message}`);
      }
    }
    return jobs;
  }
}

// ── We Work Remotely ──────────────────────────────────────────────────────────

export class WWRScraper {
  async search(keywords) {
    const jobs = [];

    for (const keyword of keywords) {
      try {
        const url = `https://weworkremotely.com/remote-jobs/search?utf8=%E2%9C%93&term=${encodeURIComponent(keyword)}`;
        const data = await fetchHtml(url);
        const $ = cheerio.load(data);

        $('section.jobs article li').each((_, el) => {
          const title   = $(el).find('.title').text().trim();
          const company = $(el).find('.company').text().trim();
          const region  = $(el).find('.region').text().trim();
          const link    = $(el).find('a').attr('href');

          if (title) {
            jobs.push({
              title, company: company || 'Unknown',
              location: region || 'Remote',
              url: link ? `https://weworkremotely.com${link}` : null,
              description: '', salary: '', source: 'weworkremotely', keyword,
            });
          }
        });
      } catch (err) {
        console.warn(`[WWR] "${keyword}": ${err.message}`);
      }
    }
    return jobs;
  }
}

// ── Remote.co ─────────────────────────────────────────────────────────────────

export class RemoteCo {
  async search(keywords) {
    const jobs = [];

    for (const keyword of keywords) {
      try {
        const url = `https://remote.co/remote-jobs/search/?search_keywords=${encodeURIComponent(keyword)}`;
        const data = await fetchHtml(url);
        const $ = cheerio.load(data);

        $('.job_listings .job_listing').each((_, el) => {
          const title   = $(el).find('.position h3').text().trim();
          const company = $(el).find('.company h3').text().trim();
          const link    = $(el).find('a').attr('href');

          if (title) {
            jobs.push({
              title, company: company || 'Unknown', location: 'Remote',
              url: link || null,
              description: '', salary: '', source: 'remote.co', keyword,
            });
          }
        });
      } catch (err) {
        console.warn(`[Remote.co] "${keyword}": ${err.message}`);
      }
    }
    return jobs;
  }
}

// ── LinkedIn (bot-blocked, stub only) ────────────────────────────────────────

export class LinkedInScraper {
  async search(keywords) {
    console.log(
      `[LinkedIn] Skipping — LinkedIn blocks automated scraping.\n` +
      `Manual search: https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords.join(' OR '))}`
    );
    return [];
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class JobScraper {
  constructor() {
    this.dice        = new DiceScraper();
    this.indeed      = new IndeedScraper();
    this.glassdoor   = new GlassdoorScraper();
    this.wwr         = new WWRScraper();
    this.remoteCo    = new RemoteCo();
    this.linkedin    = new LinkedInScraper();
  }

  async scrapeAll(keywords) {
    const minSalary = config.salaryRange.usd.min;
    console.log(`[JobScraper] Searching: ${keywords.join(', ')} | Min salary: $${minSalary.toLocaleString()}`);

    const results = await Promise.allSettled([
      config.scraping.dice     ? this.dice.search(keywords, minSalary)       : Promise.resolve([]),
      config.scraping.indeed   ? this.indeed.search(keywords, minSalary)     : Promise.resolve([]),
      config.scraping.glassdoor? this.glassdoor.search(keywords, minSalary)  : Promise.resolve([]),
      config.scraping.wwr      ? this.wwr.search(keywords)                   : Promise.resolve([]),
      config.scraping.remoteco ? this.remoteCo.search(keywords)              : Promise.resolve([]),
      config.scraping.linkedin ? this.linkedin.search(keywords)              : Promise.resolve([]),
    ]);

    const labels = ['Dice', 'Indeed', 'Glassdoor', 'WeWorkRemotely', 'Remote.co', 'LinkedIn'];
    const jobs = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        console.log(`[JobScraper] ${labels[i]}: ${result.value.length} jobs`);
        jobs.push(...result.value);
      } else {
        console.warn(`[JobScraper] ${labels[i]} failed: ${result.reason?.message}`);
      }
    });

    console.log(`[JobScraper] Total: ${jobs.length} jobs`);
    return jobs;
  }
}
