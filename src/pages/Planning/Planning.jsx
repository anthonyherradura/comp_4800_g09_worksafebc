import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useJobs } from "../../context/JobContext";
import { getSheetChecklist } from "../../data/sheets";
import "./Planning.css";

const STATUSES = [
    { value: "pending", label: "To review", symbol: "" },
    { value: "ready", label: "Ready", symbol: "✓" },
    { value: "not-applicable", label: "Not applicable", symbol: "×" },
];

// The round status button and the small menu that opens under it
function StatusPicker({ item, status, open, openUp, onToggle, onSelect, onClose }) {
    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    // Move focus into the menu when it opens, onto the current status
    useEffect(() => {
        if (!open) return;
        const options = menuRef.current.querySelectorAll('[role="menuitemradio"]');
        (menuRef.current.querySelector('[aria-checked="true"]') || options[0]).focus();
    }, [open]);

    const handleKeyDown = (e) => {
        const options = Array.from(menuRef.current.querySelectorAll('[role="menuitemradio"]'));
        const index = options.indexOf(document.activeElement);
        if (e.key === "ArrowDown") {
            e.preventDefault();
            options[(index + 1) % options.length].focus();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            options[(index - 1 + options.length) % options.length].focus();
        } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
            triggerRef.current.focus();
        } else if (e.key === "Tab") {
            onClose();
        }
    };

    const choose = (value) => {
        onSelect(value);
        onClose();
        triggerRef.current.focus();
    };

    return (
        <div className="planning-status-wrap">
            <button
                ref={triggerRef}
                type="button"
                className={`planning-status planning-status--${status.value}`}
                aria-label={`${item.label}: status, ${status.label}`}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={onToggle}
            >
                <span aria-hidden="true">{status.symbol}</span>
            </button>

            {open && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label={`${item.label}: status`}
                    className={`planning-menu${openUp ? " planning-menu--up" : ""}`}
                    onKeyDown={handleKeyDown}
                >
                    {STATUSES.map((option) => {
                        const selected = option.value === status.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="menuitemradio"
                                aria-checked={selected}
                                className={`planning-option${selected ? " planning-option--selected" : ""}`}
                                onClick={() => choose(option.value)}
                            >
                                <span className={`planning-dot planning-status--${option.value}`} aria-hidden="true">
                                    {option.symbol}
                                </span>
                                {option.label}
                                {selected && (
                                    <span className="planning-check" aria-hidden="true">
                                        ✓
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function PlanningPage() {
    const { currentJob, setChecklistStatus } = useJobs();
    const [notes, setNotes] = useState("");
    const [openId, setOpenId] = useState(null); // only one menu is open at a time
    const [openUp, setOpenUp] = useState(false);

    // The checklist comes from the job's protocol sheet; its progress is saved on the job
    const items = getSheetChecklist(currentJob?.sheetId);
    const statuses = currentJob?.checklist ?? {};
    const groups = [...new Set(items.map((item) => item.group))];

    // Items low on the screen open their menu upward so it stays visible
    const toggle = (itemId, e) => {
        setOpenUp(e.currentTarget.getBoundingClientRect().bottom > window.innerHeight * 0.6);
        setOpenId(openId === itemId ? null : itemId);
    };

    // Tapping anywhere outside the open menu closes it
    useEffect(() => {
        if (!openId) return;
        const handlePointerDown = (e) => {
            if (!e.target.closest(".planning-status-wrap")) setOpenId(null);
        };
        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [openId]);

    return (
        <div className="planning-page">
            <h2 id="planning-title" className="planning-title">
                Planning
            </h2>

            <div className="planning-panel">
                <div className="planning-card">
                    <label className="planning-label" htmlFor="planning-notes">
                        Visit notes
                    </label>
                    <textarea
                        id="planning-notes"
                        className="planning-textarea"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Add visit notes…"
                        aria-describedby="planning-demo"
                    />
                </div>
            </div>

            {items.length === 0 ? (
                <>
                    <h3 className="planning-subtitle">Preparation checklist</h3>
                    <p className="planning-card planning-empty">
                        {currentJob?.sheetId ? (
                            "This protocol sheet has no preparation items."
                        ) : (
                            <>
                                Pick a protocol sheet on <Link to="/home">Home</Link> to load what to check before you
                                go on site.
                            </>
                        )}
                    </p>
                </>
            ) : (
                groups.map((group) => {
                    const headingId = `planning-${group.toLowerCase().replace(/\W+/g, "-")}`;
                    return (
                        <section key={group} className="planning-group" aria-labelledby={headingId}>
                            <h3 id={headingId} className="planning-subtitle">
                                {group}
                            </h3>
                            <ul className="planning-panel">
                                {items
                                    .filter((item) => item.group === group)
                                    .map((item) => {
                                        const status = STATUSES.find(
                                            (option) => option.value === (statuses[item.id] || "pending")
                                        );
                                        return (
                                            <li key={item.id} className="planning-card planning-item">
                                                <StatusPicker
                                                    item={item}
                                                    status={status}
                                                    open={openId === item.id}
                                                    openUp={openUp}
                                                    onToggle={(e) => toggle(item.id, e)}
                                                    onSelect={(value) => setChecklistStatus(currentJob.id, item.id, value)}
                                                    onClose={() => setOpenId(null)}
                                                />
                                                <div className="planning-item-text">
                                                    <span className="planning-item-name">{item.label}</span>
                                                    <span className={`planning-pill planning-pill--${status.value}`}>
                                                        {status.label}
                                                    </span>
                                                </div>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </section>
                    );
                })
            )}

            <p id="planning-demo" className="planning-demo">
                Visit notes last only while this page is open.
            </p>
        </div>
    );
}