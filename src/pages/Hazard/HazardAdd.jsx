import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHazards } from "../../context/HazardContext";
import { CameraPlusIcon, MicIcon, CloseIcon } from "./HazardIcons";
import { suggestHazard } from "./suggestHazard";
import "./Hazard.css";

const SendIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
            d="M4 12 20 4l-4 16-4.5-6.5L4 12ZM11.5 13.5 20 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const InfoIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="7.75" r="1.25" fill="currentColor" />
    </svg>
);

// Page 2: add a photo, a description, or both, ask the AI for a suggested hazard, then Accept.
// The button and the suggestion box have three phases: waiting for input, getting a suggestion, suggestion ready.
export default function HazardAdd() {
    const { addHazard } = useHazards();
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState("");
    const [photoFile, setPhotoFile] = useState(null); // sent to the AI
    const [photo, setPhoto] = useState(null); // preview URL, also saved with the hazard
    const [suggestion, setSuggestion] = useState(""); // editable once the AI has answered
    const [suggested, setSuggested] = useState(false); // true once there is a suggestion to show
    const [suggesting, setSuggesting] = useState(false);
    const [error, setError] = useState("");

    const hasInput = Boolean(prompt.trim() || photoFile);
    const canSend = hasInput && !suggesting;
    const phase = suggesting ? "loading" : suggested ? "ready" : "idle";

    const resetSuggestion = () => {
        setSuggestion("");
        setSuggested(false);
    };

    const handlePhoto = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (photo) URL.revokeObjectURL(photo);
            setPhotoFile(file);
            setPhoto(URL.createObjectURL(file));
            resetSuggestion(); // the old suggestion no longer matches the input
            setError("");
        }
        e.target.value = ""; // lets the same file be picked again
    };

    const handlePrompt = (e) => {
        setPrompt(e.target.value);
        resetSuggestion();
        setError("");
    };

    const handleSend = async () => {
        if (!canSend) return;
        setSuggesting(true);
        setError("");
        resetSuggestion();
        try {
            setSuggestion(await suggestHazard({ text: prompt.trim(), photoFile }));
            setSuggested(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setSuggesting(false);
        }
    };

    const handleClear = () => {
        if (photo) URL.revokeObjectURL(photo);
        setPrompt("");
        setPhotoFile(null);
        setPhoto(null);
        resetSuggestion();
        setError("");
    };

    const handleClose = () => {
        handleClear();
        navigate("/hazard");
    };

    const handleAccept = (e) => {
        e.preventDefault();
        const name = suggestion.trim();
        if (!name) return;
        addHazard({ name, photo });
        navigate("/hazard");
    };

    return (
        <form className="ha-page" onSubmit={handleAccept}>
            <div className="ha-top">
                <h1 className="ha-title">Add hazard</h1>
                <button type="button" className="ha-close" aria-label="Close" onClick={handleClose}>
                    <CloseIcon />
                </button>
            </div>

            <section className="ha-field" aria-labelledby="ha-photo-label">
                <h2 className="ha-label" id="ha-photo-label">
                    Photo (optional)
                </h2>
                <label className="ha-drop">
                    {photo ? (
                        <>
                            <img src={photo} alt="Selected hazard" />
                            <span className="ha-change">Change</span>
                        </>
                    ) : (
                        <>
                            <CameraPlusIcon />
                            <span className="ha-drop-title">Take or upload a photo</span>
                            <span className="ha-drop-note">JPEG, PNG or WebP, up to 10 MB</span>
                        </>
                    )}
                    <input
                        className="hz-visually-hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label="Add a photo"
                        disabled={suggesting}
                        onChange={handlePhoto}
                    />
                </label>
            </section>

            <section className="ha-field" aria-labelledby="ha-describe-label">
                <h2 className="ha-label" id="ha-describe-label">
                    Describe it
                </h2>
                <div className="ha-prompt">
                    <textarea
                        className="ha-input"
                        rows={2}
                        placeholder="e.g. Ladder at a steep angle, not tied off"
                        aria-labelledby="ha-describe-label"
                        maxLength={500}
                        value={prompt}
                        disabled={suggesting}
                        onChange={handlePrompt}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault(); // Enter asks for a suggestion, it doesn't accept
                                handleSend();
                            }
                        }}
                    />
                    <button type="button" className="ha-mic" aria-label="Voice input">
                        <MicIcon />
                    </button>
                </div>
            </section>

            <button
                type="button"
                className={`ha-send ha-send--${phase}`}
                disabled={!canSend}
                aria-busy={suggesting}
                onClick={handleSend}
            >
                <SendIcon />
                {suggesting ? "Getting suggestion…" : "Get suggestion"}
            </button>

            <section className={`ha-suggest ha-suggest--${phase}`} aria-labelledby="ha-suggest-label" aria-live="polite">
                <h2 className="ha-suggest-heading" id="ha-suggest-label">
                    <span className="ha-suggest-icon">
                        <InfoIcon />
                    </span>
                    Suggested hazard
                </h2>

                {phase === "idle" && (
                    <p className="ha-suggest-text">
                        Add a photo or a description, then tap Get suggestion. It is only a suggestion: you can edit it
                        or ignore it.
                    </p>
                )}

                {phase === "loading" && (
                    <>
                        <p className="ha-suggest-status">
                            <span className="ha-dots" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                            </span>
                            Getting a suggestion…
                        </p>
                        <p className="ha-suggest-text">Usually a few seconds. You can keep typing the name yourself.</p>
                    </>
                )}

                {phase === "ready" && (
                    <>
                        <textarea
                            className="ha-suggest-input"
                            rows={2}
                            aria-label="Suggested hazard name"
                            maxLength={200}
                            value={suggestion}
                            onChange={(e) => setSuggestion(e.target.value)}
                        />
                        <p className="ha-suggest-text">Edit the name if needed, then Accept.</p>
                    </>
                )}
            </section>

            {error && (
                <p role="alert" className="hz-error">
                    {error}
                </p>
            )}

            <div className="ha-actions">
                <button type="submit" className="btn btn-orange" disabled={!suggestion.trim() || suggesting}>
                    Accept
                </button>
                <button type="button" className="btn ha-clear" onClick={handleClear} disabled={suggesting}>
                    Clear
                </button>
            </div>
        </form>
    );
}