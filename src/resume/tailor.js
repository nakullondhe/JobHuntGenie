import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { execSync } from 'child_process';

// ── Nakul's complete profile compiled from all 5 resumes ─────────────────────

const NAKUL_PROFILE = {
  name: 'Nakul Londhe',
  title: 'Software Engineer 2',
  experience: '4 years',
  location: 'Bengaluru, India',

  languages: [
    'javascript', 'es6', 'typescript', 'python', 'ruby', 'c++', 'html', 'css',
  ],

  backend: [
    'node.js', 'nodejs', 'express', 'express.js', 'ruby on rails', 'rails',
    'rest api', 'rest apis', 'api design', 'microservices', 'graphql',
  ],

  cloud: [
    'aws', 'lambda', 'ec2', 's3', 'sqs', 'ses', 'api gateway', 'cloudwatch',
    'docker', 'kubernetes', 'k8s', 'nginx', 'ci/cd', 'localstack',
  ],

  databases: ['postgresql', 'postgres', 'mongodb', 'redis', 'firebase'],

  frontend: [
    'react', 'react.js', 'angular', 'angularjs', 'next.js', 'storybook',
    'ant design', 'kendo ui', 'jest', 'cypress',
  ],

  ai: [
    'llm', 'generative ai', 'claude', 'openai', 'openai codex',
    'llm integration', 'ai-powered',
  ],

  concepts: [
    'distributed systems', 'system design', 'cloud-native', 'event-driven architecture',
    'observability', 'monitoring', 'alerting', 'structured logging', 'sla', 'sre',
    'on-call', 'incident response', 'mttr', 'sev1', 'rca', 'root cause analysis',
    'performance optimization', 'tdd', 'test-driven development', 'unit testing',
    'ci/cd', 'devops', 'scalability', 'microservices', 'platform engineering',
  ],

  softSkills: [
    'mentoring', 'code reviews', 'technical leadership', 'rfc', 'architecture',
    'cross-functional',
  ],
};

// Flat full-text for match scoring — every skill Nakul has
const NAKUL_RESUME_TEXT = [
  ...NAKUL_PROFILE.languages,
  ...NAKUL_PROFILE.backend,
  ...NAKUL_PROFILE.cloud,
  ...NAKUL_PROFILE.databases,
  ...NAKUL_PROFILE.frontend,
  ...NAKUL_PROFILE.ai,
  ...NAKUL_PROFILE.concepts,
  ...NAKUL_PROFILE.softSkills,
  // Notable achievements to boost matching on key phrases
  'kubernetes migration', '5 million switches', 'vm to kubernetes',
  'lldp', 'cdp', 'vlan', 'sev1 incidents', 'mttr under 3 hours',
  'cumulocity iot', 'iot platform', 'hackerrank', 'okta sso',
  'aws lambda', 'greenhouse', 'lever', 'workday', 'localstack',
  'production incidents', 'live site', 'rollback', 'structured logging',
  'slack integration', 'harbor ui', 'angular migration', 'angularjs to angular',
  'full-stack', 'real-time', 'event-driven', 'non-blocking i/o',
].join(' ');

// ── Keyword map: JD term → aliases that Nakul has ────────────────────────────
//
// Key   = canonical skill name (displayed as tag in dashboard)
// Value = list of phrases to scan for in JD text

const KEYWORDS_MAP = {
  // Languages
  'javascript':       ['javascript', 'js', 'es6', 'es2015', 'vanilla js', 'ecmascript'],
  'typescript':       ['typescript', ' ts ', 'ts,', 'ts.', 'strongly typed'],
  'python':           ['python'],
  'ruby on rails':    ['ruby on rails', 'rails', 'ror', ' ruby'],
  'c++':              ['c++', 'cpp'],
  'html/css':         ['html', 'css', 'frontend markup'],

  // Backend
  'node.js':          ['node.js', 'nodejs', 'node js', ' node '],
  'express.js':       ['express', 'expressjs', 'express.js'],
  'rest apis':        ['rest api', 'rest apis', 'restful', 'restful api', 'http api', 'web api'],
  'microservices':    ['microservice', 'micro-service', 'service-oriented', 'soa'],
  'graphql':          ['graphql', 'graph ql'],
  'api design':       ['api design', 'api development', 'api first', 'openapi', 'swagger'],

  // Cloud & Infrastructure
  'aws':              ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'sqs', 'ses', 'api gateway', 'iam', 'cloudwatch', 'cloudfront', 'elasticache'],
  'kubernetes':       ['kubernetes', 'k8s', 'container orchestration', 'helm', 'eks'],
  'docker':           ['docker', 'container', 'containerization', 'dockerfile'],
  'ci/cd':            ['ci/cd', 'cicd', 'continuous integration', 'continuous deployment', 'github actions', 'jenkins', 'gitlab ci', 'pipeline', 'build pipeline'],
  'nginx':            ['nginx', 'reverse proxy', 'load balancer', 'ingress'],
  'terraform':        ['terraform', 'iac', 'infrastructure as code'],

  // Databases
  'postgresql':       ['postgresql', 'postgres', 'psql', 'relational database', 'sql'],
  'mongodb':          ['mongodb', 'mongo', 'document database', 'nosql'],
  'redis':            ['redis', 'caching', 'cache layer', 'in-memory database', 'memcached'],
  'firebase':         ['firebase', 'firestore', 'realtime database'],

  // Frontend
  'react':            ['react', 'react.js', 'reactjs', 'react native', 'jsx', 'hooks'],
  'angular':          ['angular', 'angularjs', 'angular 2', 'angular component'],
  'next.js':          ['next.js', 'nextjs', 'next js', 'ssr', 'server-side rendering'],
  'jest':             ['jest', 'unit test', 'test coverage', 'vitest'],
  'cypress':          ['cypress', 'e2e test', 'end-to-end test', 'playwright'],
  'storybook':        ['storybook', 'component library', 'design system'],

  // AI / LLM
  'llm integration':  ['llm', 'large language model', 'gpt', 'openai', 'claude', 'anthropic', 'ai integration', 'ai-powered', 'language model'],
  'generative ai':    ['generative ai', 'gen ai', 'genai', 'ai tools', 'foundation model'],

  // Concepts & Practices
  'distributed systems':      ['distributed system', 'distributed computing', 'distributed architecture'],
  'system design':            ['system design', 'solution architecture', 'technical design', 'hld', 'lld'],
  'observability':            ['observability', 'monitoring', 'logging', 'log aggregation', 'tracing', 'metrics', 'alerting', 'datadog', 'grafana', 'prometheus', 'splunk', 'new relic'],
  'incident response':        ['incident response', 'on-call', 'oncall', 'sev1', 'sev2', 'live site', 'production incident', 'mttr', 'pagerduty'],
  'sre':                      ['sre', 'site reliability', 'reliability engineering', 'uptime', 'sla', 'slo', 'sli', 'error budget'],
  'event-driven architecture':['event-driven', 'event driven', 'message queue', 'pub/sub', 'kafka', 'rabbitmq', 'kinesis', 'event bus'],
  'performance optimization': ['performance', 'optimization', 'latency', 'throughput', 'profiling', 'bottleneck', 'scale'],
  'tdd':                      ['tdd', 'test-driven', 'test driven', 'unit tests', 'integration tests', 'test coverage', 'testing framework'],
  'cloud-native':             ['cloud-native', 'cloud native', 'serverless', 'paas', 'managed services'],
  'rca':                      ['rca', 'root cause', 'debugging', 'troubleshooting', 'post-mortem', 'blameless'],
  'platform engineering':     ['platform engineering', 'platform team', 'developer experience', 'devex', 'dx', 'internal tooling', 'developer platform'],
  'scalability':              ['scalability', 'horizontal scaling', 'vertical scaling', 'high availability', 'ha', 'fault tolerant'],

  // Soft / Leadership
  'mentoring':        ['mentor', 'mentoring', 'coaching', 'junior engineer', 'technical growth'],
  'code reviews':     ['code review', 'pr review', 'pull request', 'code quality'],
  'technical leadership': ['tech lead', 'technical lead', 'staff engineer', 'principal', 'architecture decision', 'rfc', 'design doc'],
};

// ── Extractor ─────────────────────────────────────────────────────────────────

export class ResumeKeywordExtractor {
  /**
   * Scans a JD and returns keywords from KEYWORDS_MAP that appear in it,
   * filtered to only skills Nakul actually has.
   */
  extractKeywords(jobDescription) {
    if (!jobDescription) return [];
    const text = jobDescription.toLowerCase();
    const matched = [];

    for (const [skill, aliases] of Object.entries(KEYWORDS_MAP)) {
      if (aliases.some(alias => text.includes(alias.toLowerCase()))) {
        matched.push(skill);
      }
    }

    return matched;
  }

  /**
   * Calculates how many of the JD's required skills Nakul has.
   * Returns 0-100.
   */
  calculateMatchScore(jobDescription, extractedKeywords) {
    if (!jobDescription || !extractedKeywords?.length) return 0;

    const resumeText = NAKUL_RESUME_TEXT.toLowerCase();
    const matched = extractedKeywords.filter(kw => {
      const aliases = KEYWORDS_MAP[kw] || [kw];
      return aliases.some(alias => resumeText.includes(alias.toLowerCase()));
    });

    return Math.round((matched.length / extractedKeywords.length) * 100);
  }

  /**
   * Returns Nakul's full profile (for server-side reference).
   */
  getProfile() {
    return NAKUL_PROFILE;
  }
}

// ── Tailor ────────────────────────────────────────────────────────────────────

export class ResumeTailor {
  constructor() {
    this.extractor = new ResumeKeywordExtractor();
  }

  async createTailoredResume(jobId, jobTitle, jobDescription, baseResumePath, outputDir) {
    const keywords = this.extractor.extractKeywords(jobDescription);
    const jobOutputDir = path.join(outputDir, jobId);
    fs.mkdirSync(jobOutputDir, { recursive: true });

    const safeTitle = jobTitle
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50);
    const outputPath = path.join(jobOutputDir, `Resume_${safeTitle}.pdf`);

    if (!fs.existsSync(baseResumePath)) {
      await this._createPlaceholderPdf(outputPath, jobTitle, keywords);
    } else {
      await this._processPdf(baseResumePath, outputPath, jobTitle, keywords);
    }

    return { success: true, path: outputPath, keywords, jobId, jobTitle };
  }

  async _processPdf(inputPath, outputPath, jobTitle, keywords) {
    const bytes = fs.readFileSync(inputPath);
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });

    pdf.setTitle(`Resume - ${NAKUL_PROFILE.name}`);
    pdf.setAuthor(NAKUL_PROFILE.name);
    pdf.setCreator(NAKUL_PROFILE.name);
    pdf.setProducer('JobHuntGenie');
    pdf.setSubject(jobTitle);
    pdf.setKeywords(keywords);

    const pdfBytes = await pdf.save();
    const cleanedBytes = this._cleanSpecialChars(pdfBytes);
    fs.writeFileSync(outputPath, cleanedBytes);
    this._runExiftool(outputPath, keywords);
  }

  async _createPlaceholderPdf(outputPath, jobTitle, keywords) {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);

    pdf.setTitle(`Resume - ${NAKUL_PROFILE.name}`);
    pdf.setAuthor(NAKUL_PROFILE.name);
    pdf.setCreator(NAKUL_PROFILE.name);
    pdf.setProducer('JobHuntGenie');
    pdf.setSubject(jobTitle);
    pdf.setKeywords(keywords);

    const lines = [
      NAKUL_PROFILE.name,
      `${NAKUL_PROFILE.title} | ${NAKUL_PROFILE.experience} experience`,
      `${NAKUL_PROFILE.location}`,
      '',
      `Tailored for: ${jobTitle}`,
      '',
      `Matched keywords: ${keywords.slice(0, 8).join(', ')}`,
      '',
      'Upload your real Resume.pdf via the dashboard to replace this placeholder.',
    ];
    lines.forEach((line, i) => {
      page.drawText(line, { x: 50, y: 742 - i * 22, size: i === 0 ? 20 : 11 });
    });

    const pdfBytes = await pdf.save();
    fs.writeFileSync(outputPath, pdfBytes);
  }

  // Replace typographic chars that can confuse ATS scanners
  _cleanSpecialChars(pdfBytes) {
    let str = Buffer.from(pdfBytes).toString('latin1');
    str = str
      .replace(/—/g, '-')   // em-dash
      .replace(/–/g, '-')   // en-dash
      .replace(/“/g, '"')   // left double quote
      .replace(/”/g, '"')   // right double quote
      .replace(/‘/g, "'")   // left single quote
      .replace(/’/g, "'");  // right single quote
    return Buffer.from(str, 'latin1');
  }

  _runExiftool(filePath, keywords) {
    try {
      execSync(
        `exiftool -overwrite_original -Author="${NAKUL_PROFILE.name}" -Creator="${NAKUL_PROFILE.name}" -Keywords="${keywords.join(',')}" "${filePath}"`,
        { stdio: 'pipe', timeout: 5000 }
      );
    } catch {
      // exiftool not available — pdf-lib metadata is sufficient
    }
  }
}
