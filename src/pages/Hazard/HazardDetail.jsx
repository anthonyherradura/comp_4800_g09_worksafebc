import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useHazards } from "../../context/HazardContext";
import { STATUS_LABEL, getHazardStatus } from "../../data/hazardStatus";
import { getSheetHazard } from "../../data/sheets";
import { BackIcon } from "./HazardIcons";
import "./Hazard.css";

const PlusIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
);

// What the protocol sheet says about a hazard: where it comes up, the controls expected, the law behind it
function SheetGuidance({ guidance }) {
    return (
        <div className="hd-guidance">
            {guidance.stage && <p className="hd-guidance-stage">{guidance.stage}</p>}
            {guidance.details.length > 0 && (
                <ul className="hd-guidance-list">
                    {guidance.details.map((d) => (
                        <li key={d}>{d}</li>
                    ))}
                </ul>
            )}
            {guidance.controls.length > 0 && (
                <>
                    <h3 className="hd-guidance-heading">Controls that should be in place</h3>
                    <ul className="hd-guidance-list">
                        {guidance.controls.map((c) => (
                            <li key={c}>{c}</li>
                        ))}
                    </ul>
                </>
            )}
            {guidance.legislation && (
                <>
                    <h3 className="hd-guidance-heading">Legislation</h3>
                    <p className="hd-guidance-text">{guidance.legislation}</p>
                </>
            )}
        </div>
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

    // Happens for a deleted hazard or a link to one that isn't saved on this device
    if (!hazard) {
        return (
            <div className="hd-page">
                <p className="hz-empty">Hazard not found.</p>
                <Link to="/hazard" className="hd-back">
                    <BackIcon /> Back
                </Link>
            </div>
        );
    }

    const created = new Date(hazard.createdAt);
    const count = hazard.photos.length;

    const handleAddPhotos = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length) addPhotos(id, files.map((f) => URL.createObjectURL(f)));
        e.target.value = "";
    };

    const handleDelete = () => {
        if (window.confirm(`Delete "${hazard.name}"? This can't be undone.`)) {
            hazard.photos.forEach((url) => URL.revokeObjectURL(url));
            deleteHazard(id);
            navigate("/hazard");
        }
    };

    return (
        <div className="hd-page">
            <div className="hd-top">
                <h2 className="hd-title">Hazard details</h2>
                <Link to="/hazard" className="hd-back">
                    <BackIcon /> Back
                </Link>
            </div>

            <div className="hd-panel">
                <div className="hd-summary">
                    <div className="hd-head">
                        <span className="hd-name">{hazard.name}</span>
                        <span className="hd-status" role="status">
                            {STATUS_LABEL[getHazardStatus(hazard)]}
                        </span>
                    </div>

                    {/* Three small rectangular tiles. The third is left blank for now */}
                    <div className="hd-tiles">
                        <span className="hd-tile">
                            {created.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                        <span className="hd-tile">
                            {count} photo{count === 1 ? "" : "s"}
                        </span>
                        <span className="hd-tile">{hazard.source === "sheet" ? "From sheet" : "Added by you"}</span>
                    </div>
                </div>
            </div>

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
                <div role="tabpanel" id="hd-panel-guidance" aria-labelledby="hd-tab-guidance">
                    <SheetGuidance guidance={guidance} />
                </div>
            ) : tab === "comment" ? (
                <div role="tabpanel" id="hd-panel-comment" aria-labelledby="hd-tab-comment">
                    <textarea
                        className="hd-textarea"
                        placeholder="Add a comment"
                        aria-label="Comment"
                        value={hazard.comment}
                        onChange={(e) => updateHazard(id, { comment: e.target.value })}
                    />
                </div>
            ) : (
                <div role="tabpanel" id="hd-panel-photos" aria-labelledby="hd-tab-photos" className="hd-photos">
                    <label className="hd-add">
                        <PlusIcon />
                        Add photos
                        <input
                            className="hz-visually-hidden"
                            type="file"
                            accept="image/*"
                            multiple
                            aria-label="Add photos"
                            onChange={handleAddPhotos}
                        />
                    </label>

                    {count === 0 ? (
                        <p className="hd-gallery-empty">No photos yet</p>
                    ) : (
                        <div className="hd-gallery">
                            {hazard.photos.map((url) => (
                                <img key={url} src={url} alt="Hazard" />
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="hd-actions">
                <button
                    type="button"
                    className="btn hd-na"
                    aria-pressed={Boolean(hazard.notApplicable)}
                    onClick={() => updateHazard(id, { notApplicable: !hazard.notApplicable })}
                >
                    {hazard.notApplicable ? "Mark as applicable" : "Mark not applicable"}
                </button>
                <button type="button" className="btn hd-delete" onClick={handleDelete}>
                    Delete
                </button>
            </div>
        </div>
    );
}