import axios from 'axios';
import * as cheerio from 'cheerio';
import config from '../config.js';

const REQUEST_TIMEOUT = 10000;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

export class DiceScraper {
  async search(keywords, minSalary = 0, maxSalary = 999999) {
    const jobs = [];
    for (const keyword of keywords) {
      try {
        const url = `https://www.dice.com/jobs?q=${encodeURIComponent(keyword)}&countryCode=US&radius=30&radiusUnit=mi&page=1&pageSize=20&filters.employmentType=FULLTIME&language=en`;
        const { data } = await axios.get(url, {
          headers: HEADERS,
          timeout: REQUEST_TIMEOUT,
        });
        const $ = cheerio.load(data);

        $('dhi-search-card, [data-cy="search-card"]').each((_, el) => {
          const title = $(el).find('[data-cy="card-title"], .card-title').text().trim();
          const company = $(el).find('[data-cy="card-company"], .card-company').text().trim();
          const location = $(el).find('[data-cy="card-location"], .card-location').text().trim();
          const link = $(el).find('a[data-cy="card-title-link"], a.card-title-link').attr('href');
          const summary = $(el).find('[data-cy="card-summary"], .card-description').text().trim();

          if (title) {
            jobs.push({
              title,
              company: company || 'Unknown',
              location: location || 'Remote',
              url: link ? (link.startsWith('http') ? link : `https://www.dice.com${link}`) : null,
              description: summary,
              source: 'dice',
              keyword,
            });
          }
        });

        // Also try JSON-LD or script data if available
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const jsonData = JSON.parse($(el).html() || '{}');
            if (Array.isArray(jsonData)) {
              jsonData.forEach(item => {
                if (item['@type'] === 'JobPosting') {
                  jobs.push({
                    title: item.title || '',
                    company: item.hiringOrganization?.name || 'Unknown',
                    location: item.jobLocation?.address?.addressLocality || 'Remote',
                    url: item.url || null,
                    description: item.description || '',
                    source: 'dice',
                    keyword,
                  });
                }
              });
            }
          } catch {
            // ignore parse errors
          }
        });
      } catch (err) {
        console.warn(`[Dice] Failed to scrape "${keyword}": ${err.message}`);
      }
    }
    return jobs;
  }
}

export class IndeedScraper {
  async search(keywords, minSalary = 0) {
    const jobs = [];
    for (const keyword of keywords) {
      try {
        const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(keyword)}&l=United+States&sort=date&limit=20`;
        const { data } = await axios.get(url, {
          headers: HEADERS,
          timeout: REQUEST_TIMEOUT,
        });
        const $ = cheerio.load(data);

        $('div.job_seen_beacon, .jobsearch-SerpJobCard, [data-jk]').each((_, el) => {
          const title = $(el).find('h2.jobTitle span, .jobtitle').first().text().trim();
          const company = $(el).find('[data-testid="company-name"], .companyName').first().text().trim();
          const location = $(el).find('[data-testid="text-location"], .companyLocation').first().text().trim();
          const jobKey = $(el).attr('data-jk');
          const summary = $(el).find('.job-snippet, .summary').text().trim();

          if (title) {
            jobs.push({
              title,
              company: company || 'Unknown',
              location: location || 'Remote',
              url: jobKey ? `https://www.indeed.com/viewjob?jk=${jobKey}` : null,
              description: summary,
              source: 'indeed',
              keyword,
            });
          }
        });
      } catch (err) {
        console.warn(`[Indeed] Failed to scrape "${keyword}": ${err.message}`);
      }
    }
    return jobs;
  }
}

export class LinkedInScraper {
  async search(keywords) {
    console.log(
      `[LinkedIn] Skipping automated scrape — LinkedIn blocks bots.\n` +
        `Manual search: https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords.join(' OR '))}`
    );
    return [];
  }
}

export class JobScraper {
  constructor() {
    this.dice = new DiceScraper();
    this.indeed = new IndeedScraper();
    this.linkedin = new LinkedInScraper();
  }

  async scrapeAll(keywords) {
    console.log(`[JobScraper] Starting search for: ${keywords.join(', ')}`);
    const results = [];

    if (config.scraping.dice) {
      console.log('[JobScraper] Scraping Dice...');
      const diceJobs = await this.dice.search(
        keywords,
        config.salaryRange.usd.min,
        config.salaryRange.usd.max
      );
      console.log(`[JobScraper] Dice: ${diceJobs.length} jobs found`);
      results.push(...diceJobs);
    }

    if (config.scraping.indeed) {
      console.log('[JobScraper] Scraping Indeed...');
      const indeedJobs = await this.indeed.search(keywords, config.salaryRange.usd.min);
      console.log(`[JobScraper] Indeed: ${indeedJobs.length} jobs found`);
      results.push(...indeedJobs);
    }

    if (config.scraping.linkedin) {
      console.log('[JobScraper] Checking LinkedIn...');
      const linkedinJobs = await this.linkedin.search(keywords);
      results.push(...linkedinJobs);
    }

    console.log(`[JobScraper] Total jobs scraped: ${results.length}`);
    return results;
  }
}
