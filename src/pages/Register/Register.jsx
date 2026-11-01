import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import useAuth from "../../auth/useAuth";
import { MIN_PASSWORD_LENGTH, validateRegister } from "../../auth/validation";
import FormField from "../../components/FormField";
import { LogoLockup } from "../../components/Logo";
import "../../styles/forms.css";
import "../Login/Login.css";
import "./Register.css";

export default function RegisterPage() {
    const { user, register } = useAuth();
    const navigate = useNavigate();
    const [values, setValues] = useState({ name: "", email: "", password: "", confirmPassword: "" });
    const [errors, setErrors] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [formError, setFormError] = useState("");
    const [pending, setPending] = useState(false);

    if (user) return <Navigate to="/jobs" replace />;

    const handleChange = (event) => {
        const next = { ...values, [event.target.name]: event.target.value };
        setValues(next);
        if (submitted) setErrors(validateRegister(next));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitted(true);
        setFormError("");
        const nextErrors = validateRegister(values);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setPending(true);
        try {
            const { name, email, password } = values;
            await register({ name, email, password });
            navigate("/jobs", { replace: true });
        } catch (error) {
            setFormError(error.message);
            setPending(false);
        }
    };

    return (
        <div className="page-content auth-page">
            <LogoLockup color="#E68A00" className="auth-logo" />
            <h1 className="auth-title">Create an account</h1>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {formError && (
                    <p className="form-error" role="alert">
                        {formError}
                    </p>
                )}

                <FormField
                    id="name"
                    label="Full name"
                    autoComplete="name"
                    value={values.name}
                    onChange={handleChange}
                    error={errors.name}
                />
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
                    hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                    type="password"
                    autoComplete="new-password"
                    value={values.password}
                    onChange={handleChange}
                    error={errors.password}
                />
                <FormField
                    id="confirmPassword"
                    label="Confirm password"
                    type="password"
                    autoComplete="new-password"
                    value={values.confirmPassword}
                    onChange={handleChange}
                    error={errors.confirmPassword}
                />

                <button type="submit" className="btn btn-orange auth-submit" disabled={pending}>
                    {pending ? "Creating account…" : "Create account"}
                </button>
            </form>

            <p className="auth-switch">
                Already have an account? <Link to="/login">Sign in</Link>
            </p>
        </div>
    );
}
