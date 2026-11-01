import { Link, Outlet } from "react-router-dom";
import { LogoLockup } from "./Logo";
import "../styles/tokens.css";
import "./Layout.css";

// Shell for pages seen before signing in: same header as the app, no bottom nav
export default function PublicLayout() {
    return (
        <div className="app-shell">
            <div className="phone">
                <header className="header">
                    <Link to="/" className="logo-link" aria-label="HIIPS360 home">
                        <LogoLockup className="header-logo" />
                    </Link>
                </header>

                <main className="page page-scroll">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
