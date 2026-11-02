import { useEffect, useState } from "react";
import { loadPhoto } from "../data/store";

export default function PhotoThumb({ id, alt = "Inspection photo" }) {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        let alive = true;
        let objectUrl;
        loadPhoto(id).then((blob) => {
            if (alive && blob) {
                objectUrl = URL.createObjectURL(blob);
                setUrl(objectUrl);
            }
        });
        return () => {
            alive = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [id]);

    return url ? <img src={url} alt={alt} style={{ maxWidth: "100%" }} /> : null;
}