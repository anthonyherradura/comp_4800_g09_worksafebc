import { createContext, useContext, useEffect, useState } from "react";
import useAuth from "../auth/useAuth";

const JobContext = createContext(null);

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Jobs are saved per signed-in user so each officer sees only their own job sites.
// Stored in localStorage for now; when the backend has a Job model, only this file needs to change.
const storageKey = (userId) => `hiips360.jobs.${userId || "anonymous"}`;

function load(userId) {
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey(userId)));
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

function save(userId, jobs) {
    try {
        localStorage.setItem(storageKey(userId), JSON.stringify(jobs));
    } catch {
        // Storage can be blocked or full. The list still works for this session.
    }
}

export function JobProvider({ children }) {
    const { user } = useAuth();
    const userId = user?.email?.toLowerCase();

    const [jobs, setJobs] = useState(() => load(userId));
    const [loadedFor, setLoadedFor] = useState(userId);

    // Reload when a different user signs in (adjust state during render, per React docs).
    if (loadedFor !== userId) {
        setLoadedFor(userId);
        setJobs(load(userId));
    }

    useEffect(() => {
        save(loadedFor, jobs);
    }, [loadedFor, jobs]);

    // `label` is whatever the officer typed: a site name ("Oak St. tower") or an address ("123 Main St").
    // Re-adding an existing label reopens that job instead of creating a duplicate.
    const addJob = (label) => {
        const clean = label.trim().replace(/\s+/g, " ");
        if (!clean) return null;

        const existing = jobs.find((j) => j.label.toLowerCase() === clean.toLowerCase());
        if (existing) {
            openJob(existing.id);
            return existing.id;
        }

        const now = new Date().toISOString();
        const job = { id: makeId(), label: clean, createdAt: now, lastOpenedAt: now };
        setJobs((prev) => [job, ...prev]);
        return job.id;
    };

    const openJob = (id) =>
        setJobs((prev) =>
            prev.map((j) => (j.id === id ? { ...j, lastOpenedAt: new Date().toISOString() } : j))
        );

    const deleteJob = (id) => setJobs((prev) => prev.filter((j) => j.id !== id));

    // The protocol sheet the officer picked for this job (a sheetId from data/sheets, or null)
    const setJobSheet = (id, sheetId) =>
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, sheetId } : j)));

    // Planning checklist progress for this job: item id (from the sheet) -> "pending" | "ready" | "not-applicable"
    const setChecklistStatus = (id, itemId, status) =>
        setJobs((prev) =>
            prev.map((j) => (j.id === id ? { ...j, checklist: { ...j.checklist, [itemId]: status } } : j))
        );

    // Most recently used first
    const sorted = [...jobs].sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
    const currentJob = sorted[0] ?? null;

    return (
        <JobContext.Provider
            value={{ jobs: sorted, currentJob, addJob, openJob, deleteJob, setJobSheet, setChecklistStatus }}
        >
            {children}
        </JobContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useJobs() {
    const ctx = useContext(JobContext);
    if (!ctx) throw new Error("useJobs must be used inside <JobProvider>");
    return ctx;
}
