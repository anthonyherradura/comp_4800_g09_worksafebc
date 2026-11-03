import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useHazards } from "../../context/HazardContext";
import { HAZARD_STATUS, STATUS_LABEL, groupByStatus, photoCount } from "../../data/hazardStatus";
import { formatFindings } from "./formatFindings";
import "./Hazard.css";

// The three tabs, in the order the summary used. "key" only picks the colours in Hazard.css.
const TABS = [
    { status: HAZARD_STATUS.UNADDRESSED, key: "todo", heading: "Still to do" },
    { status: HAZARD_STATUS.REVIEWED, key: "done", heading: "Recorded" },
    { status: HAZARD_STATUS.NOT_APPLICABLE, key: "na", heading: "Not applicable" },
];

// Placeholder page for the Search button (see HazardSearch.jsx)
const SEARCH_ROUTE = "/hazard/search";

const PlusIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
);

const SearchIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
);

const CopyIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="8.5" y="8.5" width="11" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M15.5 5.5v-.5A1.5 1.5 0 0 0 14 3.5H6A1.5 1.5 0 0 0 4.5 5v10A1.5 1.5 0 0 0 6 16.5h.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Page 1: the hazards for this job, sorted into Unaddressed / Reviewed / Not applicable tabs.
// Shows what was recorded only. It never says whether the site is compliant.
export default function HazardList() {
    const { hazards, updateHazard } = useHazards();
    const [tab, setTab] = useState(HAZARD_STATUS.UNADDRESSED);
    const [copyMessage, setCopyMessage] = useState("");

    useEffect(() => {
        if (!copyMessage) return;
        const timer = setTimeout(() => setCopyMessage(""), 4000);
        return () => clearTimeout(timer);
    }, [copyMessage]);

    const groups = groupByStatus(hazards);
    const current = TABS.find((t) => t.status === tab);
    const list = groups[tab];

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(formatFindings(hazards));
            setCopyMessage(`Copied ${hazards.length} hazard${hazards.length === 1 ? "" : "s"}.`);
        } catch {
            setCopyMessage("Couldn't copy. Your browser blocked clipboard access.");
        }
    };

    // Arrow keys move between the tabs
    const handleTabKeyDown = (e) => {
        const index = TABS.findIndex((t) => t.status === tab);
        let next = null;
        if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
        if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
        if (next === null) return;
        e.preventDefault();
        setTab(TABS[next].status);
        e.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
    };

    return (
        <div className="hl-page">
            <h1 className="hl-title">Hazards</h1>

            {hazards.length === 0 ? (
                <p className="hl-empty">
                    No hazards yet. Pick a protocol sheet on <Link to="/home">Home</Link> to load its hazards, or tap
                    “Add hazard”.
                </p>
            ) : (
                <div className="hl-tabs" role="tablist" aria-label="Hazard status">
                    {TABS.map((t) => (
                        <button
                            key={t.status}
                            type="button"
                            role="tab"
                            id={`hl-tab-${t.key}`}
                            aria-selected={tab === t.status}
                            aria-controls="hl-panel"
                            tabIndex={tab === t.status ? 0 : -1}
                            className={`hl-tab hl-tab--${t.key}`}
                            onClick={() => setTab(t.status)}
                            onKeyDown={handleTabKeyDown}
                        >
                            <span className="hl-tab-count">{groups[t.status].length}</span>
                            <span className="hl-tab-label">{STATUS_LABEL[t.status]}</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="hl-tools">
                {/* For now this opens a placeholder page. Photo-to-hazard suggestions will live there. */}
                <Link to={SEARCH_ROUTE} className="hl-tool">
                    <SearchIcon />
                    Search
                </Link>
                <Link to="/hazard/new" className="hl-tool hl-tool--primary">
                    <PlusIcon />
                    Add hazard
                </Link>
            </div>

            {hazards.length > 0 && (
                <section role="tabpanel" id="hl-panel" aria-labelledby={`hl-tab-${current.key}`}>
                    <h2 className="hl-heading">{current.heading}</h2>

                    {list.length === 0 ? (
                        <p className="hl-none">No hazards here.</p>
                    ) : (
                        <ul className="hl-list">
                            {list.map((h) => (
                                <li key={h.id} className="hl-row">
                                    <Link to={`/hazard/${h.id}`} className="hl-link">
                                        <span className="hl-text">
                                            <span className="hl-name">{h.name}</span>
                                            <span className="hl-meta">
                                                {tab === HAZARD_STATUS.REVIEWED && photoCount(h.photos.length)}
                                                {tab === HAZARD_STATUS.UNADDRESSED && "Needs a photo, or mark not applicable"}
                                                {tab === HAZARD_STATUS.NOT_APPLICABLE && "Not applicable"}
                                                {h.comment.trim() && " · comment"}
                                            </span>
                                            <span className={`hl-pill hl-pill--${current.key}`}>
                                                {STATUS_LABEL[tab]}
                                            </span>
                                        </span>
                                        <span className="hl-arrow" aria-hidden="true" />
                                    </Link>

                                    {tab === HAZARD_STATUS.UNADDRESSED && (
                                        <div className="hl-row-actions">
                                            <button
                                                type="button"
                                                className="hl-row-action"
                                                aria-label={`Mark ${h.name} not applicable`}
                                                onClick={() => updateHazard(h.id, { notApplicable: true })}
                                            >
                                                Not applicable
                                            </button>
                                        </div>
                                    )}
                                    {tab === HAZARD_STATUS.NOT_APPLICABLE && (
                                        <div className="hl-row-actions">
                                            <button
                                                type="button"
                                                className="hl-row-action"
                                                aria-label={`Undo not applicable for ${h.name}`}
                                                onClick={() => updateHazard(h.id, { notApplicable: false })}
                                            >
                                                Undo
                                            </button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {hazards.length > 0 && (
                <div className="hl-footer">
                    <button type="button" className="hl-copy" onClick={handleCopy}>
                        <CopyIcon />
                        Copy findings
                    </button>
                    {/* Inline, not a floating snackbar, so it never covers the button */}
                    <p className={`hl-hint${copyMessage ? " hl-hint--result" : ""}`} role="status">
                        {copyMessage || "Copies a plain list to paste into your own report."}
                    </p>
                    <p className="hl-hint">Findings only. HIIPS360 never says whether a site complies.</p>
                </div>
            )}
        </div>
    );
}