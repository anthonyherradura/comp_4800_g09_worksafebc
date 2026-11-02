import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../../context/JobContext";
import { formatOpened } from "../../data/recentSheets";
import "./Jobs.css";

// Job selection: its own page (no nav bar), shown after sign-in and from the header's job button.
// Picking or creating a job leads to protocol selection (/home).
const JOB_START_ROUTE = "/home";

const PlusIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
);

const SearchIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
);

// Every word typed must appear in the job's name or address, in any order or case
const matchesSearch = (label, query) => {
    const text = label.toLowerCase();
    return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => text.includes(word));
};

const CloseIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
);

export default function JobsPage() {
    const { jobs, currentJob, addJob, openJob, deleteJob } = useJobs();
    const [label, setLabel] = useState("");
    const [search, setSearch] = useState("");
    const navigate = useNavigate();
    const shown = jobs.filter((job) => matchesSearch(job.label, search));

    function handleAdd(e) {
        e.preventDefault();
        if (!addJob(label)) return;
        setLabel("");
        navigate(JOB_START_ROUTE);
    }

    function handleOpen(id) {
        openJob(id);
        navigate(JOB_START_ROUTE);
    }

    function handleDelete(job) {
        if (window.confirm(`Remove "${job.label}" from your job sites?`)) deleteJob(job.id);
    }

    return (
        <div className="jobs-page">
            <h1 className="jobs-title">Select a job site</h1>

            <form className="jobs-panel jobs-add" onSubmit={handleAdd}>
                <label className="jobs-visually-hidden" htmlFor="job-label">
                    Job site name or address
                </label>
                <input
                    id="job-label"
                    className="jobs-input"
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Job site name or address"
                    autoComplete="off"
                    enterKeyHint="done"
                />
                <button
                    type="submit"
                    className="jobs-add-btn"
                    aria-label="Create job"
                    disabled={!label.trim()}
                >
                    <PlusIcon />
                </button>
            </form>

            <section className="jobs-panel jobs-list-panel" aria-labelledby="jobs-heading">
                <h2 id="jobs-heading" className="jobs-visually-hidden">Your job sites</h2>

                {jobs.length > 0 && (
                    <div className="jobs-search" role="search">
                        <label className="jobs-visually-hidden" htmlFor="job-search">
                            Search your job sites
                        </label>
                        <span className="jobs-search-icon">
                            <SearchIcon />
                        </span>
                        <input
                            id="job-search"
                            className="jobs-input jobs-search-input"
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search your job sites"
                            autoComplete="off"
                            enterKeyHint="search"
                        />
                    </div>
                )}

                {search.trim() && shown.length > 0 && (
                    <p className="jobs-subtitle jobs-search-count" aria-live="polite">
                        {shown.length} of {jobs.length} job sites
                    </p>
                )}

                {jobs.length === 0 ? (
                    <p className="jobs-empty">
                        No job sites yet. Enter a site name or address above and tap + to create one.
                    </p>
                ) : shown.length === 0 ? (
                    <p className="jobs-empty" aria-live="polite">
                        No job sites match “{search.trim()}”. Type it in the box above and tap + to create it.
                    </p>
                ) : (
                    <ul className="jobs-list">
                        {shown.map((job) => (
                            <li className="jobs-row" key={job.id}>
                                <button
                                    type="button"
                                    className={`jobs-item${job.id === currentJob?.id ? " is-current" : ""}`}
                                    onClick={() => handleOpen(job.id)}
                                    aria-current={job.id === currentJob?.id ? "true" : undefined}
                                >
                                    <span className="jobs-label">{job.label}</span>
                                    <span className="jobs-meta">{formatOpened(job.lastOpenedAt)}</span>
                                </button>
                                <button
                                    type="button"
                                    className="jobs-remove"
                                    onClick={() => handleDelete(job)}
                                    aria-label={`Remove ${job.label}`}
                                >
                                    <CloseIcon />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {jobs.length > 0 && (
                <p className="jobs-hint">Tap a site to open it. × only removes it from this phone.</p>
            )}
        </div>
    );
}