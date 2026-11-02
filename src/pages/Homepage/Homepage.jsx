import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useHazards } from "../../context/HazardContext";
import { formatOpened } from "../../data/recentSheets";
import "./Homepage.css";

export default function HomePage() {
    const [query, setQuery] = useState("");
    const navigate = useNavigate();
    const { hazards } = useHazards();

    // Newest first, five at most.
    const recent = [...hazards]
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 5);

    function handleSearch(e) {
        e.preventDefault();
        const q = query.trim();
        navigate(q ? `/sheets?q=${encodeURIComponent(q)}` : "/sheets");
    }

    return (
        <div className="page-content">
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

            <section aria-labelledby="recent-heading">
                <h2 id="recent-heading" className="recent-heading">Recent</h2>
                {recent.length === 0 ? (
                    <p className="list-meta">No hazards added yet.</p>
                ) : (
                    <ul className="list">
                        {recent.map((hazard) => (
                            <li key={hazard.id}>
                                <Link className="list-row" to={`/hazard/${hazard.id}`}>
                                    <span>{hazard.name || "Untitled hazard"}</span>
                                    <span className="list-meta">{formatOpened(hazard.createdAt)}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}