import { useContext } from "react";
import AuthContext from "./AuthContext";

// 1. Named export (supports: import { useAuth } from "...")
export function useAuth() {
    const auth = useContext(AuthContext);
    if (!auth) throw new Error("useAuth must be used inside <AuthProvider>");
    return auth;
}

// 2. Default export (supports: import useAuth from "...")
export default useAuth;