import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useHazards } from "../../context/HazardContext";
import { HAZARD_STATUS, STATUS_LABEL, groupByStatus, photoCount } from "../../data/hazardStatus";
import { formatFindings } from "./formatFindings";
import "./Summary.css";

const SECTIONS = [HAZARD_STATUS.UNADDRESSED, HAZARD_STATUS.REVIEWED, HAZARD_STATUS.NOT_APPLICABLE];

// Review before leaving the site: every hazard has a photo or is marked not applicable.
// Shows what was recorded only. It never says whether the site is compliant.
export default function SummaryPage() {
    const { hazards, updateHazard } = useHazards();
    const [copyMessage, setCopyMessage] = useState("");

    useEffect(() => {
        if (!copyMessage) return;
        const timer = setTimeout(() => setCopyMessage(""), 4000);
        return () => clearTimeout(timer);
    }, [copyMessage]);

    const groups = groupByStatus(hazards);
    const open = groups[HAZARD_STATUS.UNADDRESSED].length;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(formatFindings(hazards));
            setCopyMessage(`Copied ${hazards.length} hazard${hazards.length === 1 ? "" : "s"}.`);
        } catch {
            setCopyMessage("Couldn't copy. Your browser blocked clipboard access.");
        }
    };

    if (hazards.length === 0) {
        return (
            <div className="page-content">
                <div className="sm-head">
                    <h1 className="sm-title">Summary</h1>
                </div>
                <p className="sm-note">Prototype. Hazards are kept on this device until you refresh.</p>
                <p className="sm-empty">No hazards recorded yet.</p>
                <Link to="/hazard" className="btn btn-orange sm-primary">
                    Go to hazards
                </Link>
            </div>
        );
    }

    return (
        <div className="page-content">
            <div className="sm-head">
                <h1 className="sm-title">Summary</h1>
            </div>
            <p className="sm-note">Prototype. Hazards are kept on this device until you refresh.</p>

            <dl className="sm-counts">
                {SECTIONS.map((status) => (
                    <div key={status} className={`sm-count sm-count--${status}`}>
                        <dt>{STATUS_LABEL[status]}</dt>
                        <dd>{groups[status].length}</dd>
                    </div>
                ))}
            </dl>

            {SECTIONS.map((status) => {
                const list = groups[status];
                if (list.length === 0) return null;
                const headingId = `sm-heading-${status}`;
                return (
                    <section key={status} className={`sm-section sm-section--${status}`} aria-labelledby={headingId}>
                        <h2 id={headingId} className="sm-heading">
                            {STATUS_LABEL[status]} ({list.length})
                        </h2>
                        <ul className="sm-list">
                            {list.map((h) => (
                                <li key={h.id} className="sm-row">
                                    <Link to={`/hazard/${h.id}`} className="sm-link">
                                        <span className="sm-name">{h.name}</span>
                                        <span className="sm-meta">
                                            {status === HAZARD_STATUS.REVIEWED && photoCount(h.photos.length)}
                                            {status === HAZARD_STATUS.UNADDRESSED && "Needs a photo"}
                                            {status === HAZARD_STATUS.NOT_APPLICABLE && "Not applicable"}
                                            {h.comment.trim() && " · comment"}
                                        </span>
                                    </Link>
                                    <div className="sm-actions">
                                        {status === HAZARD_STATUS.UNADDRESSED && (
                                            <button
                                                type="button"
                                                className="btn sm-row-action"
                                                aria-label={`Mark ${h.name} not applicable`}
                                                onClick={() => updateHazard(h.id, { notApplicable: true })}
                                            >
                                                Not applicable
                                            </button>
                                        )}
                                        {status === HAZARD_STATUS.NOT_APPLICABLE && (
                                            <button
                                                type="button"
                                                className="btn sm-row-action"
                                                aria-label={`Undo not applicable for ${h.name}`}
                                                onClick={() => updateHazard(h.id, { notApplicable: false })}
                                            >
                                                Undo
                                            </button>
                                        )}
                                        {/* Same destination as the name link, so it is skipped by keyboard and screen readers */}
                                        <Link to={`/hazard/${h.id}`} className="sm-view" tabIndex={-1} aria-hidden="true">
                                            View ▸
                                        </Link>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })}

            <div className="sm-footer">
                <button type="button" className="btn btn-orange sm-primary" onClick={handleCopy}>
                    Copy findings
                </button>
                {/* Inline, not a floating snackbar, so it never covers the button */}
                <p className={`sm-hint${copyMessage ? " sm-hint--result" : ""}`} role="status">
                    {copyMessage || "Copies a plain list to paste into your own report."}
                </p>
            </div>
        </div>
    );
}