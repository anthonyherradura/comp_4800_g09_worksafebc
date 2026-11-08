import { useEffect, useState } from "react";
import { load, save } from "../data/store";

// Works like useState, but the value survives a reload.
// Pass a null key to keep the value in memory only (nothing is read or saved).
// The third value is false until the saved data for the current key has been read.
// When the key changes (for example another officer signs in), the old value is never
// written under the new key.
export default function usePersistentState(key, initial) {
    const [value, setValue] = useState(initial);
    const [loadedKey, setLoadedKey] = useState(null);

    useEffect(() => {
        if (key == null) return;
        let alive = true;
        load(key, initial).then((v) => {
            if (alive) {
                setValue(v);
                setLoadedKey(key);
            }
        });
        return () => {
            alive = false;
        };
    }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

    // Not saved until this key has finished loading, or the starting value would overwrite your data.
    useEffect(() => {
        if (key != null && loadedKey === key) save(key, value);
    }, [key, value, loadedKey]);

    return [value, setValue, key == null || loadedKey === key];
}