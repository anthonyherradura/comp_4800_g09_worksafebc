import { useState } from "react";
import { Link } from "react-router-dom";
import { useJobs } from "../../context/JobContext";
import { SHEET_CATALOG, getSheetChecklist } from "../../data/sheets";
import "./Planning.css";

const STATUSES = [
    { value: "pending", label: "To review" },
    { value: "ready", label: "Ready" },
    { value: "not-applicable", label: "Not applicable" },
];

const CheckCircleIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <path d="m8 12.5 2.75 2.75L16.5 9.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ChevronIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Three buttons in a row; the chosen one is highlighted. Arrow keys move between them.
function StatusSegments({ item, value, onSelect }) {
    const handleKeyDown = (e) => {
        const index = STATUSES.findIndex((s) => s.value === value);
        let next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % STATUSES.length;
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + STATUSES.length) % STATUSES.length;
        if (next === null) return;
        e.preventDefault();
        const buttons = e.currentTarget.parentElement.querySelectorAll('[role="radio"]');
        onSelect(STATUSES[next].value);
        buttons[next].focus();
    };

    return (
        <div className="planning-segments" role="radiogroup" aria-label={`${item.label}: status`}>
            {STATUSES.map((option) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        className={`planning-segment planning-segment--${option.value}${selected ? " is-selected" : ""}`}
                        onClick={() => onSelect(option.value)}
                        onKeyDown={handleKeyDown}
                    >
                        {selected && option.value === "ready" && (
                            <span className="planning-segment-icon">
                                <CheckCircleIcon />
                            </span>
                        )}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export default function PlanningPage() {
    const { currentJob, setChecklistStatus, saveVisitNotes } = useJobs();
    // Shown from the job, with anything still being saved on top, so it survives leaving this page
    const notes = currentJob?.visitNotes ?? "";

    const handleNotes = (event) => {
        if (currentJob) saveVisitNotes(currentJob.id, event.target.value);
    };
    const [openGroup, setOpenGroup] = useState(null); // null until the person opens one; the first group starts open

    // The checklist comes from the job's protocol sheet; its progress is saved on the job
    const items = getSheetChecklist(currentJob?.sheetId);
    const statuses = currentJob?.checklist ?? {};
    const groups = [...new Set(items.map((item) => item.group))];
    const sheet = SHEET_CATALOG.find((s) => s.sheetId === currentJob?.sheetId);

    const statusOf = (item) => statuses[item.id] || "pending";
    const doneCount = items.filter((item) => statusOf(item) !== "pending").length;
    const percent = items.length ? Math.round((doneCount / items.length) * 100) : 0;
    const activeGroup = openGroup === null ? groups[0] : openGroup; // "" means all closed

    return (
        <div className="planning-page">
            <h1 className="planning-title">Planning</h1>

            {items.length === 0 ? (
                <p className="planning-card planning-empty">
                    {currentJob?.sheetId ? (
                        "This protocol sheet has no preparation items."
                    ) : (
                        <>
                            Pick a protocol sheet on <Link to="/home">Home</Link> to load what to check before you go
                            on site.
                        </>
                    )}
                </p>
            ) : (
                <>
                    <div className="planning-progress">
                        <p className="planning-progress-text">
                            {sheet ? `${sheet.name} checklist` : "Checklist"} · {doneCount} of {items.length} done
                        </p>
                        <div
                            className="planning-bar"
                            role="progressbar"
                            aria-label="Checklist progress"
                            aria-valuemin={0}
                            aria-valuemax={items.length}
                            aria-valuenow={doneCount}
                        >
                            <span className="planning-bar-fill" style={{ width: `${percent}%` }} />
                        </div>
                    </div>

                    {groups.map((group) => {
                        const groupItems = items.filter((item) => item.group === group);
                        const groupDone = groupItems.filter((item) => statusOf(item) !== "pending").length;
                        const open = activeGroup === group;
                        const panelId = `planning-${group.toLowerCase().replace(/\W+/g, "-")}`;
                        return (
                            <section key={group} className={`planning-card planning-group${open ? " is-open" : ""}`}>
                                <h2 className="planning-group-heading">
                                    <button
                                        type="button"
                                        className="planning-group-toggle"
                                        aria-expanded={open}
                                        aria-controls={panelId}
                                        onClick={() => setOpenGroup(open ? "" : group)}
                                    >
                                        <span className="planning-group-name">{group}</span>
                                        <span className="planning-group-count">
                                            {groupDone} of {groupItems.length}
                                        </span>
                                        <span className="planning-chevron" aria-hidden="true">
                                            <ChevronIcon />
                                        </span>
                                    </button>
                                </h2>

                                {open && (
                                    <ul id={panelId} className="planning-items">
                                        {groupItems.map((item) => (
                                            <li key={item.id} className="planning-item">
                                                <p className="planning-item-name">{item.label}</p>
                                                <StatusSegments
                                                    item={item}
                                                    value={statusOf(item)}
                                                    onSelect={(value) => setChecklistStatus(currentJob.id, item.id, value)}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                </>
            )}

            <div className="planning-notes">
                <label className="planning-label" htmlFor="planning-notes">
                    Visit notes
                </label>
                <textarea
                    id="planning-notes"
                    className="planning-textarea"
                    value={notes}
                    onChange={handleNotes}
                    maxLength={5000}
                    disabled={!currentJob}
                    placeholder="Add visit notes…"
                    aria-describedby="planning-demo"
                />
                <p id="planning-demo" className="planning-demo">
                    {currentJob ? "Saved to this job as you type." : "Pick a job site to add visit notes."}
                </p>
            </div>
        </div>
    );
}