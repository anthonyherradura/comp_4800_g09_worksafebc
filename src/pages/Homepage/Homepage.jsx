import { useState } from "react";
import { Link } from "react-router-dom";
import { MicIcon } from "../Hazard/HazardIcons";
import { suggestHazard } from "../Hazard/suggestHazard";
import "./Homepage.css";

// What the AI route returns when it can't name a hazard
const NO_HAZARD = "No hazard identified";

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

export default function HomePage() {
    const [query, setQuery] = useState("");
    const [suggestion, setSuggestion] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const canSend = query.trim() && !loading;

    function handleChange(e) {
        setQuery(e.target.value);
        setSuggestion(""); // the old suggestion no longer matches the prompt
        setError("");
    }

    // Enter and the Send button both come through here
    async function handleSend(e) {
        e.preventDefault();
        if (!canSend) return;
        setLoading(true);
        setError("");
        setSuggestion("");
        try {
            setSuggestion(await suggestHazard({ text: query.trim(), photoFile: null }));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="page-content">
            <h1 className="home-title">What work are you inspecting?</h1>

            <form className="home-panel" onSubmit={handleSend}>
                <div className="home-box">
                    <label className="home-search-label" htmlFor="home-query">
                        Describe what you see, search a sheet or regulation
                    </label>
                    <div className="home-prompt">
                        <input
                            id="home-query"
                            className="home-input"
                            type="search"
                            maxLength={500}
                            value={query}
                            disabled={loading}
                            onChange={handleChange}
                            placeholder="Construction, scaffolding, PBE, etc."
                        />
                        <button type="button" className="home-mic" aria-label="Voice input">
                            <MicIcon />
                        </button>
                        <button type="submit" className="home-send" aria-label="Send" disabled={!canSend}>
                            <SendIcon />
                        </button>
                    </div>
                </div>
            </form>

            <div className="home-panel">
                <Link className="home-card" to="/hazard">
                    <span className="home-card-text">
                        <span className="home-card-title">Identify work type/hazards from a photo</span>
                        <span className="home-card-desc">Take a photo on arrival and confirm the work type with AI</span>
                    </span>
                    <span className="home-arrow" aria-hidden="true" />
                </Link>

                <Link className="home-card" to="/pdfs">
                    <span className="home-card-text">
                        <span className="home-card-title">Protocol sheet PDFs</span>
                        <span className="home-card-desc">Open the original sheets as PDF</span>
                    </span>
                    <span className="home-arrow" aria-hidden="true" />
                </Link>
            </div>

            <section aria-labelledby="suggested-heading">
                <h2 id="suggested-heading" className="home-section-heading">
                    Suggested protocol sheet
                </h2>
                <div className="home-panel" aria-live="polite">
                    {error ? (
                        <p role="alert" className="home-box home-error">
                            {error}
                        </p>
                    ) : suggestion && suggestion !== NO_HAZARD ? (
                        <Link className="home-card" to={`/sheets?q=${encodeURIComponent(suggestion)}`}>
                            <span className="home-card-text">
                                <span className="home-card-title">{suggestion}</span>
                                <span className="home-card-desc">Find the matching protocol sheets</span>
                            </span>
                            <span className="home-arrow" aria-hidden="true" />
                        </Link>
                    ) : (
                        <p className="home-box home-muted">
                            {loading
                                ? "Thinking…"
                                : suggestion
                                    ? "No hazard identified. Try describing what you see in more detail."
                                    : "Your suggestion will appear here."}
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
}