import { Link, Navigate } from "react-router-dom";
import useInstallPrompt from "../../pwa/useInstallPrompt";
import "./Landing.css";

const OfflineIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
            d="M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 8.6 4.75 4.75 0 0 0 7 18Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
        />
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const CameraIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
            d="M3 8.5A1.5 1.5 0 0 1 4.5 7h3l1.5-2.5h6L16.5 7h3A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-10Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
        />
        <circle cx="12" cy="13.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
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
        title: "Works offline",
        text: "Sheets and inspection notes are kept on your phone, so poor signal on site doesn't stop you.",
        Icon: OfflineIcon,
    },
    {
        title: "From photo to sheet",
        text: "Take a site photo and get a suggested protocol sheet. You can also browse for it.",
        Icon: CameraIcon,
    },
    {
        title: "Your call, every time",
        text: "Every suggestion can be confirmed, edited or dismissed. The judgement stays yours.",
        Icon: CheckIcon,
    },
];

function InstallHelp({ isIOS }) {
    if (isIOS) {
        return (
            <div className="install-help">
                <p className="install-help-title">To install on iPhone or iPad:</p>
                <ol className="install-steps">
                    <li>Open this page in Safari.</li>
                    <li>
                        Tap the <strong>Share</strong> button.
                    </li>
                    <li>
                        Choose <strong>Add to Home Screen</strong>.
                    </li>
                </ol>
            </div>
        );
    }
    return (
        <p className="install-help">
            Your browser doesn't offer an install prompt here. Open this page in Chrome or Edge to
            install, or keep using it in the browser.
        </p>
    );
}

export default function LandingPage() {
    const { canInstall, promptInstall, isInstalled, isIOS } = useInstallPrompt();

    // Opened from the home screen icon: skip the pitch and go to the app
    if (isInstalled) return <Navigate to="/jobs" replace />;

    return (
        <div className="page-content landing">
            <section className="landing-hero" aria-labelledby="landing-title">
                <div className="landing-inner">
                    <p className="landing-eyebrow">Hazard Identification Inspection Protocol Sheets</p>
                    <h1 id="landing-title" className="landing-title">
                        The HIIPS sheets, <span className="landing-title-accent">on your phone</span>
                    </h1>
                    <p className="landing-lead">
                        Hazards, controls and the governing regulation for the work in front of you, built to
                        keep working when the signal drops.
                    </p>
                </div>
            </section>

            <div className="landing-inner landing-body">
                <p className="prototype-notice">
                    <span className="prototype-notice-icon">
                        <InfoIcon />
                    </span>
                    <span>
                        <strong>Prototype.</strong> HIIPS360 is a BCIT student prototype for WorkSafeBC. It is
                        not connected to WorkSafeBC systems and does not write inspection reports.
                    </span>
                </p>

                <div className="landing-actions">
                    {canInstall ? (
                        <button type="button" className="btn btn-orange landing-btn" onClick={promptInstall}>
                            Install app
                        </button>
                    ) : (
                        <InstallHelp isIOS={isIOS} />
                    )}
                    <Link to="/login" className="btn btn-outline-orange landing-btn">
                        Sign in
                    </Link>
                    <p className="landing-alt">
                        New here? <Link to="/register">Create an account</Link>
                    </p>
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
