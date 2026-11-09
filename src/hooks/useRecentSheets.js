import { useCallback, useEffect, useState } from "react";
import { api } from "../data/api";

// Home's "Recently viewed" sheets for the signed-in officer, saved on their account (server/routes/me.js).
// Returns [sheetIds newest first, remember(sheetId), loaded]. remember shows the change at once;
// if saving fails, the list is still right until the next reload.
export default function useRecentSheets(email, max = 3) {
    const [ids, setIds] = useState([]);
    const [loadedFor, setLoadedFor] = useState(null);

    useEffect(() => {
        if (!email) return;
        let alive = true;
        api("GET", "/me/recent-sheets")
            .then(({ recentSheetIds }) => alive && setIds(recentSheetIds))
            .catch(() => alive && setIds([]))
            .finally(() => alive && setLoadedFor(email));
        return () => {
            alive = false;
        };
    }, [email]);

    const remember = useCallback(
        (sheetId) => {
            setIds((prev) => [sheetId, ...prev.filter((id) => id !== sheetId)].slice(0, max));
            api("POST", "/me/recent-sheets", { sheetId }).catch(() => {});
        },
        [max],
    );

    return [ids, remember, loadedFor === email];
}
