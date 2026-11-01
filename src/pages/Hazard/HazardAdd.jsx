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

// Page 2: add a photo, a description, or both, ask the AI for a suggested hazard, then Accept
export default function HazardAdd() {
    const { addHazard } = useHazards();
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState("");
    const [photoFile, setPhotoFile] = useState(null); // sent to the AI
    const [photo, setPhoto] = useState(null); // preview URL, also saved with the hazard
    const [suggestion, setSuggestion] = useState("");
    const [suggesting, setSuggesting] = useState(false);
    const [error, setError] = useState("");

    const canSend = (prompt.trim() || photoFile) && !suggesting;

    const handlePhoto = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (photo) URL.revokeObjectURL(photo);
            setPhotoFile(file);
            setPhoto(URL.createObjectURL(file));
            setSuggestion(""); // the old suggestion no longer matches the input
            setError("");
        }
        e.target.value = ""; // lets the same file be picked again
    };

    const handlePrompt = (e) => {
        setPrompt(e.target.value);
        setSuggestion("");
        setError("");
    };

    const handleSend = async () => {
        if (!canSend) return;
        setSuggesting(true);
        setError("");
        setSuggestion("");
        try {
            setSuggestion(await suggestHazard({ text: prompt.trim(), photoFile }));
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
        setSuggestion("");
        setError("");
    };

    const handleClose = () => {
        handleClear();
        navigate("/hazard");
    };

    const handleAccept = (e) => {
        e.preventDefault();
        if (!suggestion) return;
        addHazard({ name: suggestion, photo });
        navigate("/hazard");
    };

    return (
        <form className="ha-page" onSubmit={handleAccept}>
            <div className="ha-top">
                <h2 className="ha-title">Add hazard</h2>
                <button type="button" className="ha-close" aria-label="Close" onClick={handleClose}>
                    <CloseIcon />
                </button>
            </div>

            <div className="ha-panel">
                <section className="ha-card" aria-labelledby="ha-photo-label">
                    <h3 className="ha-label" id="ha-photo-label">
                        Add a photo
                    </h3>
                    <label className="ha-drop">
                        {photo ? (
                            <>
                                <img src={photo} alt="Selected hazard" />
                                <span className="ha-change">Change</span>
                            </>
                        ) : (
                            <>
                                <CameraPlusIcon />
                                <span>Take or upload a photo</span>
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

                <section className="ha-card" aria-labelledby="ha-describe-label">
                    <h3 className="ha-label" id="ha-describe-label">
                        Describe it
                    </h3>
                    <div className="ha-prompt">
                        <input
                            className="ha-input"
                            type="text"
                            placeholder="Describe the hazard"
                            aria-label="Describe the hazard"
                            maxLength={500}
                            value={prompt}
                            disabled={suggesting}
                            onChange={handlePrompt}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault(); // Enter sends the prompt, it doesn't accept
                                    handleSend();
                                }
                            }}
                        />
                        <button type="button" className="ha-mic" aria-label="Voice input">
                            <MicIcon />
                        </button>
                    </div>
                    <button type="button" className="btn btn-orange ha-send" disabled={!canSend} onClick={handleSend}>
                        <SendIcon />
                        {suggesting ? "Thinking…" : "Send"}
                    </button>
                </section>

                <section className="ha-card" aria-labelledby="ha-suggest-label">
                    <h3 className="ha-label" id="ha-suggest-label">
                        Suggested hazard
                    </h3>
                    <div className="ha-result" aria-live="polite">
                        {suggestion ? (
                            <strong>{suggestion}</strong>
                        ) : (
                            <span className="ha-result-empty">
                                {suggesting ? "Thinking…" : "Your suggestion will appear here."}
                            </span>
                        )}
                    </div>
                </section>
            </div>

            {error && (
                <p role="alert" className="hz-error">
                    {error}
                </p>
            )}

            <div className="ha-actions">
                <button type="submit" className="btn btn-orange" disabled={!suggestion || suggesting}>
                    Accept
                </button>
                <button type="button" className="btn ha-clear" onClick={handleClear} disabled={suggesting}>
                    Clear
                </button>
            </div>
        </form>
    );
}