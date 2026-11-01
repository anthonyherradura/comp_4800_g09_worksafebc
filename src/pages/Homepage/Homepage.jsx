import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useJobs } from "../../context/JobContext";
import "./Homepage.css";

export default function HomePage() {
    const [query, setQuery] = useState("");
    const navigate = useNavigate();
    const { currentJob } = useJobs();

    function handleSearch(e) {
        e.preventDefault();
        const q = query.trim();
        navigate(q ? `/sheets?q=${encodeURIComponent(q)}` : "/sheets");
    }

    return (
        <div className="page-content">
            {currentJob && (
                <p className="home-job">
                    <span>Job: <strong>{currentJob.label}</strong></span>
                    <Link to="/jobs">Back to Home</Link>
                </p>
            )}

            <h1 className="home-title">What work are you inspecting?</h1>

            <form className="search" onSubmit={handleSearch}>
                <label className="search-label" htmlFor="home-query">
                    Describe what you see, search a sheet or regulation
                </label>
                <input
                    id="home-query"
                    className="add-input"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Construction, scaffolding, PBE, etc."
                />
            </form>

            <div className="cards">
                <Link className="card" to="/hazard">
                    <span className="card-title">Identify work from a photo</span>
                    <span className="card-desc">Take a photo on arrival and confirm the work type</span>
                </Link>

                <Link className="card" to="/pdfs">
                    <span className="card-title">Protocol sheet PDFs</span>
                    <span className="card-desc">Open the original sheets as PDF</span>
                </Link>
            </div>
        </div>
    );
}