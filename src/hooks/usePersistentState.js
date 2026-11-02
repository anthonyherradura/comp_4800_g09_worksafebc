import { useEffect, useState } from "react";
import { load, save } from "../data/store";

// Works like useState, but the value survives a reload.
// The third value is false until the saved data has been read.
export default function usePersistentState(key, initial) {
    const [value, setValue] = useState(initial);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let alive = true;
        load(key, initial).then((v) => {
            if (alive) {
                setValue(v);
                setLoaded(true);
            }
        });
        return () => {
            alive = false;
        };
    }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

    // Not saved until loading finishes, or the empty starting value would overwrite your data.
    useEffect(() => {
        if (loaded) save(key, value);
    }, [key, value, loaded]);

    return [value, setValue, loaded];
}