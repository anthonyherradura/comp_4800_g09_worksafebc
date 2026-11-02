import { useState } from "react";
import { Link } from "react-router-dom";
import { useHazards } from "../../context/HazardContext";
import { useJobs } from "../../context/JobContext";
import { SHEET_CATALOG, getSheetChecklist, getSheetHazards } from "../../data/sheets";
import { matchesWords } from "../../data/sheets/catalog";
import { shrinkImage } from "../../data/store";
import { CameraPlusIcon } from "../Hazard/HazardIcons";
import { matchSheets } from "./matchSheets";
import "./Homepage.css";

const byId = Object.fromEntries(SHEET_CATALOG.map((s) => [s.sheetId, s]));
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const SparkleIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.5 14 9l6.5 2-6.5 2-2 6.5-2-6.5-6.5-2L10 9l2-6.5Z" fill="currentColor" />
        <path d="M19 15.5 19.8 18l2.2.7-2.2.8L19 22l-.8-2.5-2.2-.8 2.2-.7.8-2.5Z" fill="currentColor" />
    </svg>
);

// One sheet in a list: tap to pick it for the job, tap again to clear it
function SheetOption({ sheet, reason, selected, onPick }) {
    return (
        <li>
            <button
                type="button"
                className={`home-card home-sheet${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onPick(sheet.sheetId)}
            >
                <span className="home-card-text">
                    <span className="home-card-title">{sheet.name}</span>
                    {reason && <span className="home-sheet-reason">{reason}</span>}
                    <span className="home-card-desc">
                        {[sheet.cu, `Issued ${sheet.issued}`].filter(Boolean).join(" · ")}
                    </span>
                </span>
                <span className="home-sheet-check" aria-hidden="true">
                    {selected && <CheckIcon />}
                </span>
            </button>
        </li>
    );
}

// Home: pick the protocol sheet for the current job by name, by describing the work (Gemini) or from a photo.
// PRD: reach the sheet for the work, and confirm or change the one offered.
export default function HomePage() {
    const { currentJob, setJobSheet } = useJobs();
    const { applySheet } = useHazards();
    const [query, setQuery] = useState("");
    const [ai, setAi] = useState({ status: "idle" }); // idle | loading | done | error
    const selected = byId[currentJob?.sheetId] ?? null;

    const aiMatches = ai.status === "done" ? ai.matches.filter((m) => byId[m.sheetId]) : [];
    const filtered = SHEET_CATALOG.filter((s) => matchesWords(s, query));
    // A description usually matches no sheet name. Once the AI has answered, list every sheet instead of none.
    const showAll = !query.trim() || (filtered.length === 0 && ai.status !== "idle");
    const listed = showAll ? SHEET_CATALOG : filtered;

    // Picking a sheet fills the job's hazard list from it (and the Planning checklist reads it too)
    function pick(sheetId) {
        const next = sheetId === selected?.sheetId ? null : sheetId;
        setJobSheet(currentJob.id, next);
        applySheet(currentJob.id, next);
    }

    async function ask({ text, photoFile }) {
        setAi({ status: "loading", fromPhoto: !!photoFile });
        try {
            const matches = await matchSheets({ text, photoFile });
            setAi({ status: "done", fromPhoto: !!photoFile, matches });
        } catch (err) {
            setAi({ status: "error", message: err.message });
        }
    }

    function handleAsk(e) {
        e.preventDefault();
        if (query.trim() && ai.status !== "loading") ask({ text: query.trim() });
    }

    async function handlePhoto(e) {
        const file = e.target.files?.[0];
        e.target.value = ""; // lets the same photo be picked again
        if (!file) return;
        // Phone photos are 3 to 5 MB; a smaller JPEG uploads faster and is plenty for Gemini
        const photoFile = (await shrinkImage(file).catch(() => null)) ?? file;
        ask({ text: query.trim(), photoFile });
    }

    if (!currentJob) {
        return (
            <div className="page-content">
                <h1 className="home-title">What work are you inspecting?</h1>
                <div className="home-panel">
                    <Link className="home-card" to="/jobs">
                        <span className="home-card-text">
                            <span className="home-card-title">Select a job site first</span>
                            <span className="home-card-desc">The protocol sheet is saved with the job</span>
                        </span>
                        <span className="home-arrow" aria-hidden="true" />
                    </Link>
                </div>
            </div>
        );
    }

    const loading = ai.status === "loading";

    return (
        <div className="page-content">
            <h1 className="home-title">What work are you inspecting?</h1>

            {selected && (
                <section className="home-selected" aria-labelledby="selected-heading">
                    <h2 id="selected-heading" className="home-section-heading">
                        Protocol sheet for <span className="home-job-name">{currentJob.label}</span>
                    </h2>
                    <p className="home-selected-name">
                        {selected.name} <span className="home-selected-cu">{selected.cu}</span>
                    </p>
                    <ul className="home-selected-links">
                        <li>
                            <Link to="/hazard">{plural(getSheetHazards(selected.sheetId).length, "hazard")} to review</Link>
                        </li>
                        <li>
                            <Link to="/planning">
                                {plural(getSheetChecklist(selected.sheetId).length, "checklist item")} before you go
                            </Link>
                        </li>
                        <li>
                            <a href={`/sheets-pdf/${selected.sheetId}.pdf`} target="_blank" rel="noreferrer">
                                Open the sheet (PDF)
                            </a>
                        </li>
                    </ul>
                </section>
            )}

            <form className="home-panel" onSubmit={handleAsk} role="search">
                <div className="home-box">
                    <label className="home-search-label" htmlFor="home-query">
                        Search sheets, or describe the work and ask AI
                    </label>
                    <div className="home-prompt">
                        <input
                            id="home-query"
                            className="home-input"
                            type="search"
                            maxLength={500}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Sheet name, CU number or the work"
                            enterKeyHint="search"
                        />
                        <label className={`home-photo${loading ? " is-disabled" : ""}`} title="Match from a photo">
                            <CameraPlusIcon />
                            <input
                                className="home-visually-hidden"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                capture="environment"
                                aria-label="Match a protocol sheet from a photo of the worksite"
                                disabled={loading}
                                onChange={handlePhoto}
                            />
                        </label>
                        <button type="submit" className="home-send" aria-label="Ask AI" disabled={!query.trim() || loading}>
                            <SparkleIcon />
                        </button>
                    </div>
                </div>
            </form>

            {ai.status !== "idle" && (
                <section aria-labelledby="ai-heading" aria-live="polite">
                    <h2 id="ai-heading" className="home-section-heading">
                        {ai.fromPhoto ? "Suggested from your photo" : "Suggested by AI"}
                    </h2>
                    {loading ? (
                        <p className="home-box home-panel-note">Matching protocol sheets…</p>
                    ) : ai.status === "error" ? (
                        <p role="alert" className="home-box home-error">{ai.message}</p>
                    ) : aiMatches.length === 0 ? (
                        <p className="home-box home-panel-note">
                            No protocol sheet covers that work. Try describing it differently, or pick from the list.
                        </p>
                    ) : (
                        <ul className="home-panel">
                            {aiMatches.map((m) => (
                                <SheetOption
                                    key={m.sheetId}
                                    sheet={byId[m.sheetId]}
                                    reason={m.reason}
                                    selected={m.sheetId === selected?.sheetId}
                                    onPick={pick}
                                />
                            ))}
                        </ul>
                    )}
                </section>
            )}

            <section aria-labelledby="all-heading">
                <h2 id="all-heading" className="home-section-heading">
                    {showAll
                        ? `All protocol sheets (${SHEET_CATALOG.length})`
                        : `${filtered.length} of ${SHEET_CATALOG.length} sheets match “${query.trim()}”`}
                </h2>
                {listed.length === 0 ? (
                    <p className="home-box home-panel-note">
                        No sheet names match. Tap Ask AI to search by what the work is.
                    </p>
                ) : (
                    <ul className="home-panel">
                        {listed.map((s) => (
                            <SheetOption key={s.sheetId} sheet={s} selected={s.sheetId === selected?.sheetId} onPick={pick} />
                        ))}
                    </ul>
                )}
            </section>

            <div className="home-panel">
                <Link className="home-card" to="/pdfs">
                    <span className="home-card-text">
                        <span className="home-card-title">Protocol sheet PDFs</span>
                        <span className="home-card-desc">Open the original sheets as PDF</span>
                    </span>
                    <span className="home-arrow" aria-hidden="true" />
                </Link>
            </div>
        </div>
    );
}
