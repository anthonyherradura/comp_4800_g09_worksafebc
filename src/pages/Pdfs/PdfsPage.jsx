import { Link } from "react-router-dom";
import { SHEETS } from "../../data/sheets";
import "../Homepage/Homepage.css";

export default function PdfsPage() {
    return (
        <div className="page-content">
            <Link to="/home">Back to home</Link>
            <h1 className="home-title">Protocol sheet PDFs</h1>

            <ul className="list">
                {SHEETS.map((s) => (
                    <li key={s.sheetId}>
                        <a
                            className="list-row"
                            href={`/sheets-pdf/${s.sheetId}.pdf`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <span>{s.title}</span>
                            <span className="list-meta">PDF</span>
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}