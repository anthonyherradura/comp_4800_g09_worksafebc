import { HAZARD_STATUS, STATUS_LABEL, groupByStatus, photoCount } from "../../data/hazardStatus";

const ORDER = [HAZARD_STATUS.UNADDRESSED, HAZARD_STATUS.REVIEWED, HAZARD_STATUS.NOT_APPLICABLE];

// Plain text the officer can paste into their own reporting system.
// Lists what was recorded only: no conclusions about compliance or orders.
export function formatFindings(hazards, now = new Date()) {
    const groups = groupByStatus(hazards);
    const stamp = now.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
    const lines = ["HIIPS360 hazard summary (prototype)", stamp];

    ORDER.forEach((status) => {
        const list = groups[status];
        if (list.length === 0) return;
        lines.push("", `${STATUS_LABEL[status]} (${list.length})`);
        list.forEach((h) => {
            const details = [];
            if (status === HAZARD_STATUS.REVIEWED) details.push(photoCount(h.photos.length));
            const comment = h.comment.trim();
            if (comment) details.push(`Comment: ${comment}`);
            lines.push(details.length ? `- ${h.name}: ${details.join(". ")}` : `- ${h.name}`);
        });
    });

    return lines.join("\n");
}
