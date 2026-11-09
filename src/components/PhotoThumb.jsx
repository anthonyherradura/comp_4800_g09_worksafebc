import { photoUrl } from "../data/api";

// A saved photo, served by the API (only to the officer who took it)
export default function PhotoThumb({ id, alt = "Inspection photo" }) {
    return <img src={photoUrl(id)} alt={alt} style={{ maxWidth: "100%" }} />;
}
