// The short form of a protocol sheet that the sheet list, word search and AI matching all use.
// Plain ESM with no Vite features, so the server (server/services/sheetCatalog.js) imports it too.

const SUMMARY_CHARS = 400;

// "Log Transport (CU 732044)" -> { name: "Log Transport", cu: "CU 732044" }
export function splitTitle(title) {
    const match = title.match(/^(.*?)\s*\((CU\s*\d+)\)\s*$/);
    return match ? { name: match[1], cu: match[2] } : { name: title, cu: "" };
}

// The sheet's own description of the work it covers (its first section), trimmed
function summarize(sheet) {
    const info = sheet.chunks.filter((c) => /classification unit information/i.test(c.section));
    // Some sheets give the unit's name a section of its own before the description
    const intro = info.find((c) => /this classification unit (covers|description)/i.test(c.text)) ?? info[0] ?? sheet.chunks[0];
    const text = (intro?.text ?? "").replace(/\s+/g, " ").trim();
    return text.length > SUMMARY_CHARS ? `${text.slice(0, SUMMARY_CHARS)}…` : text;
}

export function toCatalogEntry(sheet) {
    return {
        sheetId: sheet.sheetId,
        title: sheet.title,
        ...splitTitle(sheet.title),
        issued: sheet.issued.replaceAll("/", "-"), // sheets store 2020-05-28 or 2023/07/07
        summary: summarize(sheet),
    };
}

// Word search: every word typed must appear in the name, CU number or summary
export function matchesWords(entry, query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const haystack = `${entry.name} ${entry.cu} ${entry.summary}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
}
