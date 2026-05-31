import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { execSync } from 'child_process';

const KEYWORDS_MAP = {
  kubernetes: ['kubernetes', 'k8s', 'orchestration'],
  aws: ['aws', 'lambda', 'ec2', 's3', 'rds', 'cloudwatch', 'iam'],
  backend: ['node.js', 'nodejs', 'express', 'rest api', 'rest apis', 'graphql'],
  frontend: ['react', 'typescript', 'angular', 'vue', 'javascript'],
  database: ['postgresql', 'postgres', 'mongodb', 'redis', 'mysql', 'dynamodb'],
  devops: ['docker', 'ci/cd', 'jenkins', 'github actions', 'terraform', 'monitoring'],
  'system design': ['distributed systems', 'scalability', 'microservices', 'architecture'],
  mentoring: ['mentoring', 'leadership', 'code reviews', 'technical lead'],
  'incident response': ['on-call', 'oncall', 'mttr', 'sev1', 'sre', 'reliability'],
  python: ['python', 'django', 'flask', 'fastapi'],
  java: ['java', 'spring', 'spring boot', 'jvm'],
  go: ['golang', 'go language'],
  security: ['security', 'oauth', 'jwt', 'authentication', 'authorization'],
  testing: ['unit testing', 'integration testing', 'tdd', 'jest', 'pytest'],
};

export class ResumeKeywordExtractor {
  extractKeywords(jobDescription) {
    if (!jobDescription) return [];
    const text = jobDescription.toLowerCase();
    const matched = [];

    for (const [category, terms] of Object.entries(KEYWORDS_MAP)) {
      for (const term of terms) {
        if (text.includes(term)) {
          matched.push(term);
          break;
        }
      }
    }

    // Also extract capitalized tech terms directly from description
    const techPattern = /\b(Python|Java|Go|Rust|Scala|Kotlin|Swift|TypeScript|JavaScript|React|Angular|Vue|Node\.js|AWS|GCP|Azure|Kubernetes|Docker|Terraform|PostgreSQL|MongoDB|Redis|Kafka|Spark|Hadoop)\b/gi;
    const directMatches = [...new Set((jobDescription.match(techPattern) || []).map(m => m.toLowerCase()))];

    return [...new Set([...matched, ...directMatches])];
  }

  calculateMatchScore(resumeText, keywords) {
    if (!keywords.length || !resumeText) return 0;
    const text = resumeText.toLowerCase();
    const matched = keywords.filter(kw => text.includes(kw.toLowerCase()));
    return Math.round((matched.length / keywords.length) * 100);
  }
}

export class ResumeTailor {
  constructor() {
    this.extractor = new ResumeKeywordExtractor();
  }

  async createTailoredResume(jobId, jobTitle, jobDescription, baseResumePath, outputDir) {
    const keywords = this.extractor.extractKeywords(jobDescription);
    const jobOutputDir = path.join(outputDir, jobId);
    fs.mkdirSync(jobOutputDir, { recursive: true });

    const safeTitle = jobTitle.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 50);
    const outputPath = path.join(jobOutputDir, `Resume_${safeTitle}.pdf`);

    if (!fs.existsSync(baseResumePath)) {
      // Create a placeholder PDF if the resume doesn't exist yet
      await this._createPlaceholderPdf(outputPath, jobTitle, keywords);
    } else {
      await this._processPdf(baseResumePath, outputPath, jobTitle, keywords);
    }

    return {
      success: true,
      path: outputPath,
      keywords,
      jobId,
      jobTitle,
    };
  }

  async _processPdf(inputPath, outputPath, jobTitle, keywords) {
    const bytes = fs.readFileSync(inputPath);
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });

    // Set document metadata
    pdf.setTitle(`Resume - Nakul Londhe`);
    pdf.setAuthor('Nakul Londhe');
    pdf.setCreator('Nakul Londhe');
    pdf.setProducer('JobHuntGenie');
    pdf.setSubject(jobTitle);
    pdf.setKeywords(keywords);

    const pdfBytes = await pdf.save();
    const cleanedBytes = this._cleanDashes(pdfBytes);
    fs.writeFileSync(outputPath, cleanedBytes);

    // Try exiftool cleanup if available
    this._runExiftool(outputPath, keywords);
  }

  async _createPlaceholderPdf(outputPath, jobTitle, keywords) {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);

    pdf.setTitle('Resume - Nakul Londhe');
    pdf.setAuthor('Nakul Londhe');
    pdf.setCreator('Nakul Londhe');
    pdf.setProducer('JobHuntGenie');
    pdf.setSubject(jobTitle);
    pdf.setKeywords(keywords);

    page.drawText('Nakul Londhe', { x: 50, y: 742, size: 24 });
    page.drawText('Software Engineer', { x: 50, y: 710, size: 14 });
    page.drawText(`Tailored for: ${jobTitle}`, { x: 50, y: 680, size: 12 });
    page.drawText(`Keywords: ${keywords.slice(0, 8).join(', ')}`, { x: 50, y: 650, size: 10 });
    page.drawText('Place your Resume.pdf in the ./resume directory', { x: 50, y: 600, size: 10 });

    const pdfBytes = await pdf.save();
    fs.writeFileSync(outputPath, pdfBytes);
  }

  _cleanDashes(pdfBytes) {
    // Convert em-dashes and en-dashes in the raw PDF stream to hyphens
    let str = Buffer.from(pdfBytes).toString('latin1');
    str = str
      .replace(/—/g, '-')   // em-dash
      .replace(/–/g, '-')   // en-dash
      .replace(/“/g, '"')   // left double quote
      .replace(/”/g, '"');  // right double quote
    return Buffer.from(str, 'latin1');
  }

  _runExiftool(filePath, keywords) {
    try {
      execSync(
        `exiftool -overwrite_original -Author="Nakul Londhe" -Creator="Nakul Londhe" -Keywords="${keywords.join(',')}" "${filePath}"`,
        { stdio: 'pipe', timeout: 5000 }
      );
    } catch {
      // exiftool not available — pdf-lib metadata is sufficient
    }
  }
}
