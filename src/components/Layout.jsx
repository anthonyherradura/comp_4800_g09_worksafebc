import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";
import { useJobs } from "../context/JobContext";
import { LogoLockup } from "./Logo";
import "../styles/tokens.css";
import "./Layout.css";

const HomeIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.5 1.5 11.5h2.8V21h6v-6h3.4v6h6v-9.5h2.8L18 7.3V3.5h-3v1.2L12 2.5Z" fill="currentColor" />
    </svg>
);

const PlanningIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="18" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <rect x="8" y="2" width="8" height="4" rx="1.2" fill="currentColor" />
        <path d="M8 11h2M12 11h4M8 15h2M12 15h4M8 19h2M12 19h4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
);

const HazardIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.5 23 21.5H1L12 2.5Z" fill="currentColor" strokeLinejoin="round" />
        <path d="M12 9v6" stroke="#ED8B00" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="12" cy="18" r="1.4" fill="#ED8B00" />
    </svg>
);

const JobIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2Z" fill="currentColor" />
    </svg>
);

const SignOutIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12h11M16 7.5l4.5 4.5-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const NAV_ITEMS = [
    { to: "/home", label: "Home", Icon: HomeIcon },
    { to: "/planning", label: "Planning", Icon: PlanningIcon },
    { to: "/hazard", label: "Hazards", Icon: HazardIcon },
];

// showNav: false for job selection (/jobs), which is its own page outside the regular navigation
export default function Layout({ showNav = true }) {
    const { logout } = useAuth();
    const { currentJob } = useJobs();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    return (
        <div className="app-shell">
            <div className="phone">
                <header className="header">
                    <Link to="/home" className="logo-link" aria-label="HIIPS360 home">
                        <LogoLockup className="header-logo" />
                    </Link>
                    {showNav && (
                        <Link to="/jobs" className="job-btn" aria-label={currentJob ? `Job: ${currentJob.label}. Change job` : "Select a job"}>
                            <JobIcon />
                            <span className="job-btn-label">{currentJob ? currentJob.label : "Select job"}</span>
                        </Link>
                    )}
                    <button type="button" className="signout-btn" onClick={handleSignOut}>
                        <SignOutIcon />
                        Sign out
                    </button>
                </header>

                {/* The current page renders here */}

                <main className="page">
                    <Outlet />
                </main>

                {showNav && (
                    <nav className="nav" aria-label="Main navigation">
                        {NAV_ITEMS.map(({ to, label, Icon }) => (
                            <NavLink
                                key={to}
                                to={to}
                                aria-label={label}
                                className={({ isActive }) => (isActive ? "nav-btn active" : "nav-btn")}
                            >
                                <Icon />
                                <span className="nav-label">{label}</span>
                            </NavLink>
                        ))}
                    </nav>
                )}
            </div>
        </div>
    );
}