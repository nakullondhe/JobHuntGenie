import React, { useState, useEffect, useCallback } from 'react';
import './Dashboard.css';

const STATUS_LABELS = {
  new: 'New',
  resume_generated: 'Resume Ready',
  applied: 'Applied',
  archived: 'Archived',
};

const STATUS_NEXT = {
  new: 'resume_generated',
  resume_generated: 'applied',
  applied: 'archived',
};

function StatCard({ label, value, color }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function JobCard({ job, onGenerateResume, onUpdateStatus, onSelect }) {
  return (
    <div className={`job-card job-card--${job.status}`} onClick={() => onSelect(job)}>
      <div className="job-card__header">
        <h3 className="job-card__title">{job.title}</h3>
        <span className={`status-badge status-badge--${job.status}`}>
          {STATUS_LABELS[job.status] || job.status}
        </span>
      </div>
      <div className="job-card__meta">
        <span className="job-card__company">{job.company}</span>
        <span className="job-card__sep">·</span>
        <span className="job-card__location">{job.location}</span>
        {job.source && <span className="job-card__source">{job.source}</span>}
      </div>
      {typeof job.matchScore === 'number' && (
        <div className="job-card__score">
          <div
            className="score-bar"
            style={{ width: `${job.matchScore}%` }}
            title={`Match score: ${job.matchScore}%`}
          />
          <span className="score-label">{job.matchScore}% match</span>
        </div>
      )}
      {job.keywords && job.keywords.length > 0 && (
        <div className="job-card__keywords">
          {job.keywords.slice(0, 6).map(kw => (
            <span key={kw} className="keyword-tag">{kw}</span>
          ))}
          {job.keywords.length > 6 && (
            <span className="keyword-tag keyword-tag--more">+{job.keywords.length - 6}</span>
          )}
        </div>
      )}
      <div className="job-card__actions" onClick={e => e.stopPropagation()}>
        {job.status === 'new' && (
          <button className="btn btn--primary btn--sm" onClick={() => onGenerateResume(job.id)}>
            Generate Resume
          </button>
        )}
        {job.status === 'resume_generated' && (
          <>
            <a
              className="btn btn--info btn--sm"
              href={`/api/download-resume/${job.id}`}
              download
            >
              Download PDF
            </a>
            <button
              className="btn btn--success btn--sm"
              onClick={() => onUpdateStatus(job.id, 'applied')}
            >
              Mark Applied
            </button>
          </>
        )}
        {job.url && (
          <a className="btn btn--outline btn--sm" href={job.url} target="_blank" rel="noreferrer">
            View Job
          </a>
        )}
      </div>
    </div>
  );
}

function JobModal({ job, onClose, onGenerateResume, onUpdateStatus }) {
  if (!job) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-header">
          <h2>{job.title}</h2>
          <span className={`status-badge status-badge--${job.status}`}>
            {STATUS_LABELS[job.status] || job.status}
          </span>
        </div>
        <div className="modal-meta">
          <strong>{job.company}</strong> · {job.location}
          {job.source && <span className="job-card__source">{job.source}</span>}
        </div>
        {typeof job.matchScore === 'number' && (
          <div className="modal-score">
            Match Score: <strong>{job.matchScore}%</strong>
            <div className="score-bar-bg">
              <div className="score-bar" style={{ width: `${job.matchScore}%` }} />
            </div>
          </div>
        )}
        {job.keywords && job.keywords.length > 0 && (
          <div className="modal-keywords">
            <strong>Keywords: </strong>
            {job.keywords.map(kw => (
              <span key={kw} className="keyword-tag">{kw}</span>
            ))}
          </div>
        )}
        {job.description && (
          <div className="modal-description">
            <strong>Description:</strong>
            <p>{job.description}</p>
          </div>
        )}
        <div className="modal-actions">
          {job.status === 'new' && (
            <button className="btn btn--primary" onClick={() => { onGenerateResume(job.id); onClose(); }}>
              Generate Resume
            </button>
          )}
          {job.status === 'resume_generated' && (
            <>
              <a className="btn btn--info" href={`/api/download-resume/${job.id}`} download>
                Download PDF
              </a>
              <button className="btn btn--success" onClick={() => { onUpdateStatus(job.id, 'applied'); onClose(); }}>
                Mark Applied
              </button>
            </>
          )}
          {STATUS_NEXT[job.status] && job.status !== 'resume_generated' && (
            <button
              className="btn btn--outline"
              onClick={() => { onUpdateStatus(job.id, STATUS_NEXT[job.status]); onClose(); }}
            >
              Move to {STATUS_LABELS[STATUS_NEXT[job.status]]}
            </button>
          )}
          {job.url && (
            <a className="btn btn--outline" href={job.url} target="_blank" rel="noreferrer">
              View on {job.source || 'Job Board'}
            </a>
          )}
        </div>
        <div className="modal-footer">
          Added: {new Date(job.createdAt).toLocaleDateString()}
          {job.updatedAt !== job.createdAt && ` · Updated: ${new Date(job.updatedAt).toLocaleDateString()}`}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState(null);
  const [message, setMessage] = useState('');
  const [resumeFilename, setResumeFilename] = useState(null);

  const checkResume = useCallback(async () => {
    try {
      const res = await fetch('/api/has-resume');
      const data = await res.json();
      if (data.hasResume) setResumeFilename(data.filename);
    } catch {}
  }, []);

  const handleUploadResume = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('resume', file);
    setMessage('Uploading resume...');
    try {
      const res = await fetch('/api/upload-resume', { method: 'POST', body: form });
      const data = await res.json();
      if (data.success) {
        setResumeFilename(data.filename);
        setMessage(`Resume "${data.filename}" uploaded successfully.`);
      } else {
        setMessage(`Upload error: ${data.error}`);
      }
    } catch (err) {
      setMessage(`Upload error: ${err.message}`);
    }
    setTimeout(() => setMessage(''), 5000);
  };

  const fetchJobs = useCallback(async (status) => {
    try {
      const url = status && status !== 'all' ? `/api/jobs?status=${status}` : '/api/jobs';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setJobs(data.jobs);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchJobs(filter), fetchStats(), checkResume()]).finally(() => setLoading(false));

    const interval = setInterval(() => {
      fetchJobs(filter);
      fetchStats();
    }, 60000);
    return () => clearInterval(interval);
  }, [filter, fetchJobs, fetchStats]);

  const handleGenerateResume = async (jobId) => {
    setMessage('Generating resume...');
    try {
      const res = await fetch(`/api/jobs/${jobId}/generate-resume`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage(`Resume generated! Keywords: ${data.keywords.slice(0, 4).join(', ')}`);
        await Promise.all([fetchJobs(filter), fetchStats()]);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
    setTimeout(() => setMessage(''), 5000);
  };

  const handleTriggerScrape = async () => {
    setScraping(true);
    setMessage('Searching for jobs...');
    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage(`Found ${data.scraped} jobs, added ${data.added} new ones.`);
        await Promise.all([fetchJobs(filter), fetchStats()]);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setScraping(false);
    }
    setTimeout(() => setMessage(''), 7000);
  };

  const handleUpdateStatus = async (jobId, status) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        await Promise.all([fetchJobs(filter), fetchStats()]);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const filters = [
    { key: 'all', label: 'All Jobs' },
    { key: 'new', label: 'New' },
    { key: 'resume_generated', label: 'Resume Ready' },
    { key: 'applied', label: 'Applied' },
    { key: 'archived', label: 'Archived' },
  ];

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="header__content">
          <h1>JobHuntGenie</h1>
          <p className="header__subtitle">Automated Job Search & Resume Tailoring</p>
        </div>
        <div className="header__actions">
          <label className={`btn ${resumeFilename ? 'btn--outline-white' : 'btn--warning'}`} title={resumeFilename ? `Resume: ${resumeFilename}` : 'Upload your base resume PDF'}>
            {resumeFilename ? `📄 ${resumeFilename}` : '⬆ Upload Resume'}
            <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleUploadResume} />
          </label>
          <button
            className="btn btn--primary"
            onClick={handleTriggerScrape}
            disabled={scraping}
          >
            {scraping ? 'Searching...' : 'Search Jobs'}
          </button>
        </div>
      </header>

      {message && (
        <div className="message-banner">
          {message}
        </div>
      )}

      <div className="stats-grid">
        <StatCard label="Total Jobs" value={stats.totalJobs || 0} color="blue" />
        <StatCard label="New" value={stats.newJobs || 0} color="blue" />
        <StatCard label="Resume Ready" value={stats.generated || 0} color="green" />
        <StatCard label="Applied" value={stats.applied || 0} color="gray" />
        <StatCard label="Avg Match" value={`${stats.avgScore || 0}%`} color="purple" />
      </div>

      <div className="filter-bar">
        {filters.map(f => (
          <button
            key={f.key}
            className={`filter-btn${filter === f.key ? ' filter-btn--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <h3>No jobs found</h3>
          <p>Click "Search Jobs" to find new opportunities, or change the filter.</p>
        </div>
      ) : (
        <div className="jobs-grid">
          {jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onGenerateResume={handleGenerateResume}
              onUpdateStatus={handleUpdateStatus}
              onSelect={setSelectedJob}
            />
          ))}
        </div>
      )}

      <JobModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onGenerateResume={handleGenerateResume}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}
