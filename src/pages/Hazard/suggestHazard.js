// Asks the server (which asks Gemini) for a hazard suggestion, and whether it is one of the job's hazards.
// hazards: [{ id, name }]. Resolves to { suggestion, matchId, description }: matchId is null for a new hazard,
// and description is the AI's write-up of what it saw ("" if none).
// Throws Error(message) on failure, same style as the auth service.
export async function suggestHazard({ text, photoFile, hazards = [] }) {
    const body = new FormData();
    if (text) body.append("text", text);
    if (photoFile) body.append("photo", photoFile);
    if (hazards.length) body.append("hazards", JSON.stringify(hazards.map(({ id, name }) => ({ id, name }))));

    let res;
    try {
        res = await fetch("/api/ai/suggest-hazard", { method: "POST", body, credentials: "same-origin" });
    } catch {
        // No signal: fetch rejects with the browser's own text ("Failed to fetch", "Load failed")
        throw new Error("Couldn't reach the server. Check your connection and try again.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Couldn't get a suggestion. Try again.");
    return { suggestion: data.suggestion, matchId: data.matchId ?? null, description: data.description ?? "" };
}