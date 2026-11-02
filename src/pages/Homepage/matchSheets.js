// Asks the server (which asks Gemini) which protocol sheets cover the work in a description and/or photo.
// Resolves to [{ sheetId, reason }], best first. Throws Error(message) on failure, like suggestHazard.
export async function matchSheets({ text, photoFile }) {
    const body = new FormData();
    if (text) body.append("text", text);
    if (photoFile) body.append("photo", photoFile);

    let res;
    try {
        res = await fetch("/api/ai/match-sheet", { method: "POST", body, credentials: "same-origin" });
    } catch {
        throw new Error("Couldn't reach the server. Check your connection and try again.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Couldn't match a protocol sheet. Try again.");
    return data.matches ?? [];
}
