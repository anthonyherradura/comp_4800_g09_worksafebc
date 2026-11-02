import { useEffect, useRef, useState } from "react";
import "./Planning.css";

const INITIAL_ITEMS = [
    { id: "sheet", label: "Confirm protocol sheet" },
    { id: "equipment", label: "Review protective equipment" },
    { id: "practices", label: "Review site practices" },
    { id: "questions", label: "Prepare inspection questions" },
];

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
    const [notes, setNotes] = useState("");
    const [statuses, setStatuses] = useState({});
    const [openId, setOpenId] = useState(null); // only one menu is open at a time

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

            <h3 id="planning-checklist-title" className="planning-subtitle">
                Preparation checklist
            </h3>

            <ul className="planning-panel" aria-labelledby="planning-checklist-title">
                {INITIAL_ITEMS.map((item, index) => {
                    const status = STATUSES.find((option) => option.value === (statuses[item.id] || "pending"));
                    return (
                        <li key={item.id} className="planning-card planning-item">
                            <StatusPicker
                                item={item}
                                status={status}
                                open={openId === item.id}
                                openUp={index >= INITIAL_ITEMS.length / 2} // lower items open upward so the menu stays on screen
                                onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                                onSelect={(value) => setStatuses((previous) => ({ ...previous, [item.id]: value }))}
                                onClose={() => setOpenId(null)}
                            />
                            <div className="planning-item-text">
                                <span className="planning-item-name">{item.label}</span>
                                <span className={`planning-pill planning-pill--${status.value}`}>{status.label}</span>
                            </div>
                        </li>
                    );
                })}
            </ul>

            <p id="planning-demo" className="planning-demo">
                Sample checklist · Changes last only while this page is open.
            </p>
        </div>
    );
}