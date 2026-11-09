import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useHazards } from "../../context/HazardContext";
import { HAZARD_STATUS, STATUS_LABEL, groupByStatus, photoCount } from "../../data/hazardStatus";
import { getSheetHazard } from "../../data/sheets";
import { formatFindings } from "./formatFindings";
import "./Hazard.css";

// The three tabs, in the order the summary used. "key" only picks the colours in Hazard.css.
const TABS = [
    { status: HAZARD_STATUS.UNADDRESSED, key: "todo", heading: "Still to do" },
    { status: HAZARD_STATUS.REVIEWED, key: "done", heading: "Recorded" },
    { status: HAZARD_STATUS.NOT_APPLICABLE, key: "na", heading: "Not applicable" },
];

const PlusIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
);

const DownloadIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v11M7.5 11 12 15.5l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 19.5h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
);

// Page 1: the hazards for this job, sorted into Unaddressed / Reviewed / Not applicable tabs.
// Shows what was recorded only. It never says whether the site is compliant.
export default function HazardList() {
    const { hazards, updateHazard } = useHazards();
    const [tab, setTab] = useState(HAZARD_STATUS.UNADDRESSED);
    const [exportMessage, setExportMessage] = useState("");
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        if (!exportMessage) return;
        const timer = setTimeout(() => setExportMessage(""), 4000);
        return () => clearTimeout(timer);
    }, [exportMessage]);

    const groups = groupByStatus(hazards);
    const current = TABS.find((t) => t.status === tab);
    const list = groups[tab];

    // Builds the PDF (every hazard with its comment and photos) and saves it. Always includes all hazards.
    const handleExport = async () => {
        setExporting(true);
        try {
            await formatFindings(hazards);
            setExportMessage(`PDF ready with ${hazards.length} hazard${hazards.length === 1 ? "" : "s"}.`);
        } catch {
            setExportMessage("Couldn't create the PDF. Try again.");
        } finally {
            setExporting(false);
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
                    “Log hazard”.
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
                <Link to="/hazard/new" className="hl-tool hl-tool--primary">
                    <PlusIcon />
                    Log hazard
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
                                            {getSheetHazard(h.sheetId, h.sheetKey)?.notTypical && (
                                                <span className="hl-note">Sheet says not typical</span>
                                            )}
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
                    <button type="button" className="hl-copy" onClick={handleExport} disabled={exporting}>
                        <DownloadIcon />
                        {exporting ? "Creating PDF…" : "Download PDF"}
                    </button>
                    {/* Inline, not a floating snackbar, so it never covers the button */}
                    <p className={`hl-hint${exportMessage ? " hl-hint--result" : ""}`} role="status">
                        {exportMessage || "Saves a PDF with each hazard's comment and photos."}
                    </p>
                    <p className="hl-hint">Findings only. HIIPS360 never says whether a site complies.</p>
                </div>
            )}
        </div>
    );
}