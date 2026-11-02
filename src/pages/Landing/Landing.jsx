import { Link, Navigate } from "react-router-dom";
import { LogoStacked } from "../../components/Logo";
import useInstallPrompt from "../../pwa/useInstallPrompt";
import "./Landing.css";

const DocumentIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
            d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
        />
        <path d="M14 3v5h5M8.5 13h7M8.5 17h7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const CameraPlusIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
            d="M3 8.5A1.5 1.5 0 0 1 4.5 7h3l1.5-2.5h6L16.5 7h3A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-10Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
        />
        <path d="M12 11.25v4.5M9.75 13.5h4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const CheckIcon = () => (
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

const InfoIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="7.75" r="1.25" fill="currentColor" />
    </svg>
);

const BENEFITS = [
    {
        title: "Every sheet in your pocket",
        text: "Search in plain words, or browse the original protocol sheets.",
        Icon: DocumentIcon,
    },
    {
        title: "From photo to hazard",
        text: "Photograph or describe what you see and get a suggested hazard name.",
        Icon: CameraPlusIcon,
    },
    {
        title: "Your call, every time",
        text: "Every suggestion can be confirmed, edited or dismissed.",
        Icon: CheckIcon,
    },
];

export default function LandingPage() {
    const { canInstall, promptInstall, isInstalled, isIOS } = useInstallPrompt();

    // Opened from the home screen icon: skip the pitch and go to the app
    if (isInstalled) return <Navigate to="/jobs" replace />;

    return (
        <div className="page-content landing">
            <section className="landing-hero" aria-labelledby="landing-title">
                <div className="landing-inner">
                    <div className="landing-logo">
                        <LogoStacked />
                    </div>
                    <p className="landing-eyebrow">Hazard Identification Inspection Protocol Sheets</p>
                    <h1 id="landing-title" className="landing-title">
                        The HIIPS sheets, on your phone
                    </h1>
                    <p className="landing-lead">
                        Hazards, controls and the governing regulation for the work in front of you.
                    </p>
                </div>
            </section>

            <div className="landing-body">
                <p className="prototype-notice">
                    <span className="prototype-notice-icon">
                        <InfoIcon />
                    </span>
                    <span>
                        Prototype. HIIPS360 is a BCIT student prototype for WorkSafeBC. It isn't connected to
                        WorkSafeBC systems and doesn't write inspection reports.
                    </span>
                </p>

                <div className="landing-actions">
                    <Link to="/login" className="btn btn-orange landing-btn">
                        Sign in
                    </Link>
                    <Link to="/register" className="btn btn-outline-orange landing-btn">
                        Create an account
                    </Link>

                    {canInstall ? (
                        <button type="button" className="landing-install-btn" onClick={promptInstall}>
                            Install the app on your phone
                        </button>
                    ) : (
                        <p className="landing-install">
                            {isIOS
                                ? "Install it: in Safari tap Share, then Add to Home Screen."
                                : "Your browser doesn't offer an install prompt here. Open this page in Chrome or Edge to install, or keep using it in the browser."}
                        </p>
                    )}
                </div>

                <section className="landing-benefits" aria-labelledby="benefits-title">
                    <h2 id="benefits-title" className="landing-subtitle">
                        What it does
                    </h2>
                    <ul className="benefits">
                        {BENEFITS.map(({ title, text, Icon }) => (
                            <li key={title} className="benefit">
                                <span className="benefit-icon">
                                    <Icon />
                                </span>
                                <div>
                                    <h3 className="benefit-title">{title}</h3>
                                    <p className="benefit-text">{text}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}