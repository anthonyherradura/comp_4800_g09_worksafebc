import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useHazards } from "../../context/HazardContext";
import { STATUS_LABEL, getHazardStatus } from "../../data/hazardStatus";
import { getSheetHazard } from "../../data/sheets";
import { BackIcon, CameraPlusIcon, CloseIcon } from "./HazardIcons";
import "./Hazard.css";

const CheckCircleIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
            d="m8 12.5 2.75 2.75L16.5 9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The sheet stores legislation as one run of text, e.g.
// "WCA Section 21, General duties of employers OHSR Section 3.23, Young or new worker orientation ..."
// Each entry starts with an act name in capitals followed by "Section", so split there, then at the first comma
// into { reference: "WCA s.21", title: "General duties of employers" }.
// Also accepts lines or ";" between entries, an array of strings, or an array of { reference, title }.
const ENTRY_START = /\s+(?=[A-Z]{2,}\s+(?:Section|s\.|Part)\b)/;

// "WCA Section 21" -> "WCA s.21", "OHSR Section 3.23" -> "OHSR 3.23"
function shortReference(reference) {
    const match = reference.match(/^([A-Z]{2,})\s+(?:Section|s\.)\s*(.+)$/);
    if (!match) return reference;
    return match[1] === "WCA" ? `${match[1]} s.${match[2]}` : `${match[1]} ${match[2]}`;
}

function parseLegislation(value) {
    if (!value) return [];
    const parts = Array.isArray(value) ? value : String(value).split(/\r?\n|;/);
    return parts
        .flatMap((part) => (typeof part === "string" ? part.split(ENTRY_START) : [part]))
        .map((entry) => {
            if (entry && typeof entry === "object") return entry;
            const text = String(entry).replace(/^[-•*]\s*/, "").trim();
            if (!text) return null;
            const comma = text.indexOf(",");
            if (comma === -1) return { reference: shortReference(text), title: "" };
            return {
                reference: shortReference(text.slice(0, comma).trim()),
                title: text.slice(comma + 1).trim(),
            };
        })
        .filter(Boolean);
}

// What the protocol sheet says about a hazard: the controls expected and the law behind them
function SheetGuidance({ guidance }) {
    const legislation = parseLegislation(guidance.legislation);
    return (
        <>
            {guidance.details.length > 0 && (
                <ul className="hd-bullets">
                    {guidance.details.map((d) => (
                        <li key={d}>{d}</li>
                    ))}
                </ul>
            )}

            {guidance.controls.length > 0 && (
                <section aria-labelledby="hd-controls-label">
                    <h2 className="ha-label" id="hd-controls-label">
                        Controls that should be in place
                    </h2>
                    <ul className="hd-controls">
                        {guidance.controls.map((c) => (
                            <li key={c}>
                                <span className="hd-controls-icon">
                                    <CheckCircleIcon />
                                </span>
                                <span>{c}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {legislation.length > 0 && (
                <section aria-labelledby="hd-law-label">
                    <h2 className="ha-label" id="hd-law-label">
                        Legislation
                    </h2>
                    <ul className="hd-law-list">
                        {legislation.map((law) => (
                            <li key={`${law.reference}-${law.title}`} className="hd-law">
                                <span className="hd-law-ref">{law.reference}</span>
                                {law.title && <span className="hd-law-title">{law.title}</span>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
}

// Page 3: hazard info, sheet guidance, comment, photo collection, not applicable, delete
export default function HazardDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { hazards, updateHazard, addPhotos, deleteHazard } = useHazards();
    const hazard = hazards.find((h) => h.id === id);
    const guidance = hazard?.source === "sheet" ? getSheetHazard(hazard.sheetId, hazard.sheetKey) : null;
    const [tab, setTab] = useState(guidance ? "guidance" : "comment"); // "guidance" | "comment" | "photos"
    const [deleting, setDeleting] = useState(false);

    // Just deleted here: the list is about to show
    if (!hazard && deleting) return null;

    // Happens for a deleted hazard, or a link to one that isn't this officer's
    if (!hazard) {
        return (
            <div className="hd-page">
                <p className="hz-empty">Hazard not found.</p>
                <Link to="/hazard" className="hd-back">
                    <BackIcon /> Hazards
                </Link>
            </div>
        );
    }

    const count = hazard.photos.length;
    const statusKey = getHazardStatus(hazard);
    const page = hazard.page ?? guidance?.page; // shown only if the sheet data has a page number

    const handleAddPhotos = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length) addPhotos(id, files.map((f) => URL.createObjectURL(f)));
        e.target.value = "";
    };

    const handleRemovePhoto = (url) => {
        if (window.confirm("Remove this photo? This can't be undone.")) {
            updateHazard(id, { photos: hazard.photos.filter((p) => p !== url) });
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Delete "${hazard.name}"? This can't be undone.`)) {
            // Back to the list once the server has deleted it, so it doesn't show there for a moment
            setDeleting(true);
            if (await deleteHazard(id)) navigate("/hazard");
            else setDeleting(false);
        }
    };

    return (
        <div className="hd-page">
            <Link to="/hazard" className="hd-back">
                <BackIcon /> Hazards
            </Link>

            <header className="hd-head">
                {guidance?.stage && <p className="hd-kicker">{guidance.stage}</p>}
                <h1 className="hd-name">{hazard.name}</h1>
                <div className="hd-meta">
                    <span className={`hd-status hd-status--${statusKey}`} role="status">
                        {STATUS_LABEL[statusKey]}
                    </span>
                    <span className="hd-meta-text">
                        {page ? `Page ${page} · ` : ""}
                        {plural(count, "photo")}
                    </span>
                </div>
            </header>

            <div className="hd-tabs" role="tablist" aria-label="Hazard details">
                {guidance && (
                    <button
                        type="button"
                        role="tab"
                        id="hd-tab-guidance"
                        aria-selected={tab === "guidance"}
                        aria-controls="hd-panel-guidance"
                        className="hd-tab"
                        onClick={() => setTab("guidance")}
                    >
                        Guidance
                    </button>
                )}
                <button
                    type="button"
                    role="tab"
                    id="hd-tab-comment"
                    aria-selected={tab === "comment"}
                    aria-controls="hd-panel-comment"
                    className="hd-tab"
                    onClick={() => setTab("comment")}
                >
                    Comment
                </button>
                <button
                    type="button"
                    role="tab"
                    id="hd-tab-photos"
                    aria-selected={tab === "photos"}
                    aria-controls="hd-panel-photos"
                    className="hd-tab"
                    onClick={() => setTab("photos")}
                >
                    Photos ({count})
                </button>
            </div>

            {tab === "guidance" && guidance ? (
                <div role="tabpanel" id="hd-panel-guidance" aria-labelledby="hd-tab-guidance" className="hd-body">
                    <SheetGuidance guidance={guidance} />
                </div>
            ) : tab === "comment" ? (
                <div role="tabpanel" id="hd-panel-comment" aria-labelledby="hd-tab-comment" className="hd-body">
                    <textarea
                        className="hd-textarea"
                        placeholder="Add a comment"
                        aria-label="Comment"
                        value={hazard.comment}
                        onChange={(e) => updateHazard(id, { comment: e.target.value })}
                    />
                </div>
            ) : (
                <div role="tabpanel" id="hd-panel-photos" aria-labelledby="hd-tab-photos" className="hd-body">
                    {count === 0 ? (
                        <p className="hd-gallery-empty">No photos yet</p>
                    ) : (
                        <div className="hd-gallery">
                            {hazard.photos.map((url, i) => (
                                <div key={url} className="hd-photo">
                                    <img src={url} alt={`Hazard photo ${i + 1}`} />
                                    <button
                                        type="button"
                                        className="hd-photo-remove"
                                        aria-label={`Remove photo ${i + 1}`}
                                        onClick={() => handleRemovePhoto(url)}
                                    >
                                        <CloseIcon />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="hd-actions">
                {/* Photos are added from here on every tab */}
                <label className="btn btn-orange hd-add">
                    <CameraPlusIcon />
                    Add photo
                    <input
                        className="hz-visually-hidden"
                        type="file"
                        accept="image/*"
                        multiple
                        aria-label="Add photos"
                        onChange={handleAddPhotos}
                    />
                </label>
                <button
                    type="button"
                    className="btn hd-na"
                    aria-pressed={Boolean(hazard.notApplicable)}
                    onClick={() => updateHazard(id, { notApplicable: !hazard.notApplicable })}
                >
                    {hazard.notApplicable ? "Mark as applicable" : "Not applicable"}
                </button>
            </div>

            <button type="button" className="hd-delete" onClick={handleDelete}>
                Delete hazard
            </button>
        </div>
    );
}