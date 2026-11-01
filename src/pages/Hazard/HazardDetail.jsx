import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useHazards } from "../../context/HazardContext";
import { STATUS_LABEL, getHazardStatus } from "../../data/hazardStatus";
import { BackIcon } from "./HazardIcons";
import "./Hazard.css";

const PlusIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
);

// Page 3: hazard info, comment, photo collection, not applicable, delete
export default function HazardDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { hazards, updateHazard, addPhotos, deleteHazard } = useHazards();
    const [tab, setTab] = useState("comment"); // "comment" | "photos"
    const hazard = hazards.find((h) => h.id === id);

    // Happens if the page is refreshed (data only lives in memory for now)
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
                        <span className="hd-tile hd-tile--blank" />
                    </div>
                </div>
            </div>

            <div className="hd-tabs" role="tablist" aria-label="Hazard details">
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

            {tab === "comment" ? (
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