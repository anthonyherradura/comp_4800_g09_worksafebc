import { Link } from "react-router-dom";
import { useHazards } from "../../context/HazardContext";
import "./Hazard.css";

const PlusIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
);

const photoLabel = (n) => `${n} photo${n === 1 ? "" : "s"}`;
const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Page 1: scrollable list of hazards
export default function HazardList() {
    const { hazards } = useHazards();

    return (
        <div className="hl-page">
            <div className="hl-top">
                <h2 className="hl-title">Hazards</h2>
                <span className="hl-count">{hazards.length}</span>
            </div>

            <Link to="/hazard/new" className="btn btn-orange hl-add">
                <PlusIcon />
                Add hazard
            </Link>

            <ul className="hl-panel">
                {hazards.length === 0 ? (
                    <li className="hl-empty">No hazards yet. Tap “Add hazard” to create one.</li>
                ) : (
                    hazards.map((h) => (
                        <li key={h.id}>
                            <Link to={`/hazard/${h.id}`} className="hl-card">
                                <span className="hl-name">{h.name}</span>
                                <span className="hl-meta">
                                    {photoLabel(h.photos.length)} · {formatDate(h.createdAt)}
                                </span>
                                <span className="hl-divider" />
                                <span className="hl-view">
                                    View
                                    <span className="hl-arrow" />
                                </span>
                            </Link>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
}