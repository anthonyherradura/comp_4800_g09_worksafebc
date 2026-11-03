import { Link } from "react-router-dom";
import { BackIcon } from "./HazardIcons";
import "./Hazard.css";

// Placeholder for the Search button on the Hazards page.
// Later: take a photo and the AI suggests a hazard. Nothing here searches yet.
export default function HazardSearch() {
    return (
        <div className="hl-page">
            <Link to="/hazard" className="hd-back">
                <BackIcon /> Hazards
            </Link>
            <h1 className="hl-title">Search</h1>
            <p className="hl-none">Coming soon: take a photo and get a suggested hazard.</p>
        </div>
    );
}