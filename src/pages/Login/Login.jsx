import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../../auth/useAuth";
import { validateLogin } from "../../auth/validation";
import FormField from "../../components/FormField";
import { LogoLockup } from "../../components/Logo";
import "../../styles/forms.css";
import "./Login.css";

const InfoIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="7.75" r="1.25" fill="currentColor" />
    </svg>
);

export default function LoginPage() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [values, setValues] = useState({ email: "", password: "" });
    const [errors, setErrors] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [formError, setFormError] = useState("");
    const [pending, setPending] = useState(false);

    // Send the officer back to the page they were trying to open
    const redirectTo = location.state?.from?.pathname ?? "/jobs";

    if (user) return <Navigate to={redirectTo} replace />;

    const handleChange = (event) => {
        const next = { ...values, [event.target.name]: event.target.value };
        setValues(next);
        // Only re-check as they type once they've tried to submit
        if (submitted) setErrors(validateLogin(next));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitted(true);
        setFormError("");
        const nextErrors = validateLogin(values);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setPending(true);
        try {
            await login(values);
            navigate(redirectTo, { replace: true });
        } catch (error) {
            setFormError(error.message);
            setPending(false);
        }
    };

    return (
        <div className="page-content auth-page auth-login">
            <LogoLockup color="#E68A00" className="auth-logo" />
            <h1 className="auth-title">Sign in</h1>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {formError && (
                    <p className="form-error" role="alert">
                        {formError}
                    </p>
                )}

                <FormField
                    id="email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={values.email}
                    onChange={handleChange}
                    error={errors.email}
                />
                <FormField
                    id="password"
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    value={values.password}
                    onChange={handleChange}
                    error={errors.password}
                />
                <p className="auth-hint">At least 8 characters.</p>

                <button type="submit" className="btn btn-orange auth-submit" disabled={pending}>
                    {pending ? "Signing in…" : "Sign in"}
                </button>
            </form>

            <p className="auth-switch">
                New to HIIPS360? <Link to="/register">Create an account</Link>
            </p>

            <p className="auth-notice">
                <span className="auth-notice-icon">
                    <InfoIcon />
                </span>
                <span>Prototype for WorkSafeBC by BCIT students. Not connected to WorkSafeBC systems.</span>
            </p>
        </div>
    );
}