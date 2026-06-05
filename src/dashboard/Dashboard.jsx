import React, { useState, useEffect, useCallback } from 'react';
import './Dashboard.css';

const SOURCE_COLORS = {
  dice:          '#2563eb',
  indeed:        '#16a34a',
  glassdoor:     '#ea580c',
  weworkremotely:'#7c3aed',
  'remote.co':   '#0891b2',
};

const STATUS_META = {
  new:              { label: 'New',         color: '#6366f1', bg: '#eef2ff' },
  resume_generated: { label: 'Ready',       color: '#10b981', bg: '#ecfdf5' },
  applied:          { label: 'Applied',     color: '#f59e0b', bg: '#fffbeb' },
  archived:         { label: 'Archived',    color: '#94a3b8', bg: '#f8fafc' },
};

function ScoreRing({ score }) {
  const r = 18, c = 2 * Math.PI * r;
  const fill = (score / 100) * c;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#6366f1' : '#f59e0b';
  return (
    <div className="score-ring" title={`${score}% match`}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={`${fill} ${c}`} strokeLinecap="round"
          transform="rotate(-90 22 22)" />
      </svg>
      <span className="score-ring__label" style={{ color }}>{score}%</span>
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="stat-card" style={{ '--accent': accent }}>
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__body">
        <div className="stat-card__value">{value}</div>
        <div className="stat-card__label">{label}</div>
      </div>
    </div>
  );
}

function SourceBadge({ source }) {
  const color = SOURCE_COLORS[source] || '#64748b';
  return (
    <span className="source-badge" style={{ color, borderColor: color + '33', background: color + '12' }}>
      {source}
    </span>
  );
}

function StatusPill({ status }) {
  const m = STATUS_META[status] || { label: status, color: '#64748b', bg: '#f1f5f9' };
  return (
    <span className="status-pill" style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  );
}

function JobCard({ job, onUpdateStatus, onSelect }) {
  const hasResume = job.hasResume || job.status === 'resume_generated';
  const preparing = job.status === 'new' && !hasResume;

  return (
    <div className="job-card" onClick={() => onSelect(job)}>
      <div className="job-card__top">
        <div className="job-card__title-row">
          <h3 className="job-card__title">{job.title}</h3>
          <StatusPill status={job.status} />
        </div>
        <div className="job-card__meta">
          <span className="job-card__company">{job.company}</span>
          {job.location && <span className="job-card__dot">·</span>}
          <span className="job-card__location">{job.location}</span>
        </div>
        <div className="job-card__badges">
          {job.source && <SourceBadge source={job.source} />}
        </div>
      </div>

      {typeof job.matchScore === 'number' && (
        <div className="job-card__score-row">
          <ScoreRing score={job.matchScore} />
          <div className="job-card__keywords">
            {(job.keywords || []).slice(0, 5).map(kw => (
              <span key={kw} className="kw-chip">{kw}</span>
            ))}
            {(job.keywords || []).length > 5 && (
              <span className="kw-chip kw-chip--more">+{job.keywords.length - 5}</span>
            )}
          </div>
        </div>
      )}

      <div className="job-card__actions" onClick={e => e.stopPropagation()}>
        {preparing ? (
          <span className="preparing-badge">
            <span className="spinner" /> Generating resume…
          </span>
        ) : hasResume ? (
          <>
            <a className="btn btn--download" href={`/api/download-resume/${job.id}`} download>
              ↓ Download Resume
            </a>
            {job.status !== 'applied' && job.status !== 'archived' && (
              <button className="btn btn--apply" onClick={() => onUpdateStatus(job.id, 'applied')}>
                Mark Applied
              </button>
            )}
          </>
        ) : null}
        {job.url && (
          <a className="btn btn--ghost" href={job.url} target="_blank" rel="noreferrer">
            View Job ↗
          </a>
        )}
      </div>
    </div>
  );
}

function JobModal({ job, onClose, onUpdateStatus }) {
  if (!job) return null;
  const hasResume = job.hasResume || job.status === 'resume_generated';
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose}>✕</button>

        <div className="modal__header">
          <div>
            <h2 className="modal__title">{job.title}</h2>
            <div className="modal__meta">
              <strong>{job.company}</strong>
              {job.location && <> · {job.location}</>}
              {job.source && <SourceBadge source={job.source} />}
            </div>
          </div>
          <div className="modal__status-score">
            <StatusPill status={job.status} />
            {typeof job.matchScore === 'number' && <ScoreRing score={job.matchScore} />}
          </div>
        </div>

        {job.keywords?.length > 0 && (
          <div className="modal__section">
            <div className="modal__section-label">Matched Keywords</div>
            <div className="modal__keywords">
              {job.keywords.map(kw => <span key={kw} className="kw-chip">{kw}</span>)}
            </div>
          </div>
        )}

        {job.description && (
          <div className="modal__section">
            <div className="modal__section-label">Job Description</div>
            <p className="modal__description">{job.description}</p>
          </div>
        )}

        <div className="modal__actions">
          {hasResume && (
            <a className="btn btn--download" href={`/api/download-resume/${job.id}`} download>
              ↓ Download Tailored Resume
            </a>
          )}
          {job.status !== 'applied' && job.status !== 'archived' && hasResume && (
            <button className="btn btn--apply" onClick={() => { onUpdateStatus(job.id, 'applied'); onClose(); }}>
              Mark Applied
            </button>
          )}
          {job.status === 'applied' && (
            <button className="btn btn--ghost" onClick={() => { onUpdateStatus(job.id, 'archived'); onClose(); }}>
              Archive
            </button>
          )}
          {job.url && (
            <a className="btn btn--ghost" href={job.url} target="_blank" rel="noreferrer">
              View Original Posting ↗
            </a>
          )}
        </div>

        <div className="modal__footer">
          Added {new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [jobs, setJobs]         = useState([]);
  const [stats, setStats]       = useState({});
  const [loading, setLoading]   = useState(true);
  const [scraping, setScraping] = useState(false);
  const [filter, setFilter]     = useState('all');
  const [selected, setSelected] = useState(null);
  const [toast, setToast]       = useState('');

  const showToast = (msg, duration = 5000) => {
    setToast(msg);
    setTimeout(() => setToast(''), duration);
  };

  const fetchJobs = useCallback(async (status) => {
    try {
      const url = status && status !== 'all' ? `/api/jobs?status=${status}` : '/api/jobs';
      const data = await fetch(url).then(r => r.json());
      if (data.success) setJobs(data.jobs);
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await fetch('/api/stats').then(r => r.json());
      if (data.success) setStats(data.stats);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([fetchJobs(filter), fetchStats()]).finally(() => setLoading(false));
    const t = setInterval(() => { fetchJobs(filter); fetchStats(); }, 30000);
    return () => clearInterval(t);
  }, [filter, fetchJobs, fetchStats]);

  const handleScrape = async () => {
    setScraping(true);
    showToast('Searching 5 job boards…', 30000);
    try {
      const data = await fetch('/api/scrape', { method: 'POST' }).then(r => r.json());
      if (data.success) {
        showToast(`Found ${data.scraped} jobs · ${data.added} new added · generating resumes…`);
        await Promise.all([fetchJobs(filter), fetchStats()]);
      } else {
        showToast(`Error: ${data.error}`);
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setScraping(false);
    }
  };

  const handleUpdateStatus = async (jobId, status) => {
    try {
      const data = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => r.json());
      if (data.success) { fetchJobs(filter); fetchStats(); }
    } catch {}
  };

  const FILTERS = [
    { key: 'all',              label: 'All',         count: stats.totalJobs },
    { key: 'new',              label: 'New',         count: stats.newJobs },
    { key: 'resume_generated', label: 'Ready',       count: stats.generated },
    { key: 'applied',          label: 'Applied',     count: stats.applied },
    { key: 'archived',         label: 'Archived',    count: null },
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <div className="header__logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="white" fillOpacity="0.15"/>
              <path d="M7 14C7 10.134 10.134 7 14 7s7 3.134 7 7-3.134 7-7 7-7-3.134-7-7z" stroke="white" strokeWidth="2"/>
              <path d="M14 11v3l2 2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="header__text">
            <h1>JobHuntGenie</h1>
            <p>5 job boards · auto resume tailoring · real-time matching</p>
          </div>
        </div>
        <button className="btn btn--search" onClick={handleScrape} disabled={scraping}>
          {scraping
            ? <><span className="spinner spinner--white" /> Searching…</>
            : '🔍 Search Jobs Now'}
        </button>
      </header>

      {toast && <div className="toast">{toast}</div>}

      <main className="main">
        <div className="stats-row">
          <StatCard icon="📋" label="Total Jobs"    value={stats.totalJobs  || 0} accent="#6366f1" />
          <StatCard icon="✨" label="New"           value={stats.newJobs    || 0} accent="#6366f1" />
          <StatCard icon="📄" label="Resume Ready" value={stats.generated  || 0} accent="#10b981" />
          <StatCard icon="✅" label="Applied"      value={stats.applied    || 0} accent="#f59e0b" />
          <StatCard icon="🎯" label="Avg Match"    value={`${stats.avgScore || 0}%`} accent="#8b5cf6" />
        </div>

        <div className="filter-bar">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`filter-pill${filter === f.key ? ' filter-pill--active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {f.count != null && <span className="filter-pill__count">{f.count}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spinner spinner--lg" />
            <p>Loading…</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🔍</div>
            <h3>No jobs yet</h3>
            <p>Click <strong>Search Jobs Now</strong> to scan 5 job boards for your target roles.</p>
            <button className="btn btn--search" onClick={handleScrape} disabled={scraping}>
              Search Jobs Now
            </button>
          </div>
        ) : (
          <div className="jobs-grid">
            {jobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onUpdateStatus={handleUpdateStatus}
                onSelect={setSelected}
              />
            ))}
          </div>
        )}
      </main>

      <JobModal
        job={selected}
        onClose={() => setSelected(null)}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}
