import { HAZARD_STATUS, STATUS_LABEL, groupByStatus, photoCount } from "../../data/hazardStatus";

// Reviewed first, then what's still to do, then not applicable
const ORDER = [HAZARD_STATUS.REVIEWED, HAZARD_STATUS.UNADDRESSED, HAZARD_STATUS.NOT_APPLICABLE];

const MARGIN = 15; // mm
const PHOTO_GAP = 6; // mm between the two photos in a row
const PHOTO_MAX_HEIGHT = 80; // mm
const PHOTO_MAX_PIXELS = 1000; // longest side before it goes in the PDF; keeps the file small
const PT_TO_MM = 0.3528;

function loadImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null); // a photo that won't load is skipped, not fatal
        img.src = url;
    });
}

// Photos are object URLs held in memory. Draw each one onto a canvas to get a smaller JPEG for the PDF.
async function toJpeg(url) {
    const img = await loadImage(url);
    if (!img) return null;
    const scale = Math.min(1, PHOTO_MAX_PIXELS / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // transparent PNGs would otherwise turn black
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return { data: canvas.toDataURL("image/jpeg", 0.8), width, height };
}

// A PDF the officer can save or share: every hazard with its comment and photos.
// Lists what was recorded only: no conclusions about compliance or orders.
// jsPDF is loaded when the button is tapped, so it doesn't add to the app's first load.
export async function formatFindings(hazards, now = new Date()) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - MARGIN * 2;
    const cellWidth = (contentWidth - PHOTO_GAP) / 2;
    let y = MARGIN;

    const ensureRoom = (height) => {
        if (y + height > pageHeight - MARGIN) {
            doc.addPage();
            y = MARGIN;
        }
    };

    // Wraps long text and starts a new page when it runs out of room
    const write = (text, { size = 11, bold = false, color = [0, 0, 0], after = 1.5 } = {}) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.setTextColor(...color);
        const lineHeight = size * PT_TO_MM * 1.35;
        doc.splitTextToSize(text, contentWidth).forEach((line) => {
            ensureRoom(lineHeight);
            doc.text(line, MARGIN, y + size * PT_TO_MM);
            y += lineHeight;
        });
        y += after;
    };

    const stamp = now.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
    write("HIIPS360 hazard summary (prototype)", { size: 18, bold: true, after: 1 });
    write(stamp, { size: 10, color: [110, 100, 90], after: 6 });

    const groups = groupByStatus(hazards);

    for (const status of ORDER) {
        const list = groups[status];
        if (list.length === 0) continue;

        ensureRoom(20);
        write(`${STATUS_LABEL[status]} (${list.length})`, { size: 14, bold: true, after: 3 });

        for (const hazard of list) {
            const comment = hazard.comment.trim();
            const photos = (await Promise.all(hazard.photos.map(toJpeg))).filter(Boolean);

            ensureRoom(30); // keep the name with at least the start of its details
            write(hazard.name, { size: 12, bold: true, after: 0.5 });
            write(`${STATUS_LABEL[status]} · ${photoCount(hazard.photos.length)}`, {
                size: 9,
                color: [110, 100, 90],
                after: 2,
            });
            write(comment ? `Comment: ${comment}` : "No comment.", {
                size: 10.5,
                color: comment ? [0, 0, 0] : [110, 100, 90],
                after: 3,
            });

            // Photos two to a row, each as wide as its half of the page allows
            for (let i = 0; i < photos.length; i += 2) {
                const row = photos.slice(i, i + 2).map((photo) => {
                    const scale = Math.min(cellWidth / photo.width, PHOTO_MAX_HEIGHT / photo.height);
                    return { ...photo, w: photo.width * scale, h: photo.height * scale };
                });
                const rowHeight = Math.max(...row.map((p) => p.h));
                ensureRoom(rowHeight);
                row.forEach((p, index) => {
                    doc.addImage(p.data, "JPEG", MARGIN + index * (cellWidth + PHOTO_GAP), y, p.w, p.h);
                });
                y += rowHeight + 4;
            }

            // A thin line between hazards
            ensureRoom(6);
            doc.setDrawColor(210, 205, 200);
            doc.line(MARGIN, y, pageWidth - MARGIN, y);
            y += 5;
        }
        y += 2;
    }

    write("Findings only. HIIPS360 never says whether a site complies.", { size: 9, color: [110, 100, 90] });

    const date = now.toISOString().slice(0, 10);
    doc.save(`hazard-findings-${date}.pdf`);
}