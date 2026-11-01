import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../../auth/useAuth";
import { validateLogin } from "../../auth/validation";
import FormField from "../../components/FormField";
import "../../styles/forms.css";
import "./Login.css";

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
        <div className="page-content auth-page">
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

                <button type="submit" className="btn btn-orange auth-submit" disabled={pending}>
                    {pending ? "Signing in…" : "Sign in"}
                </button>
            </form>

            <p className="auth-switch">
                New to HIIPS360? <Link to="/register">Create an account</Link>
            </p>
        </div>
    );
}
