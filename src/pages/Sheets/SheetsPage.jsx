import { Link, useParams, useSearchParams } from "react-router-dom";
import { SHEETS } from "../../data/sheets";
import SheetSearch from "../Hazard/SheetSearch";

export default function SheetsPage() {
    const { sheetId } = useParams();
    const [params] = useSearchParams();
    const sheet = SHEETS.find((s) => s.sheetId === sheetId);

    return (
        <div className="page-content">
            <Link to="/home">Back to home</Link>
            <h1>{sheet ? sheet.title : "Find a protocol sheet"}</h1>
            <SheetSearch
                key={sheetId || "all"}
                sheetId={sheetId}
                initialQuery={params.get("q") || ""}
            />
        </div>
    );
}