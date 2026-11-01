import { CAP_HEIGHT, HIIPS, NUM, STACK_HIIPS, STACK_NUM } from "./logoPaths";

// HIIPS360 logo, from the brand board (Primary lockup, Light background, Stacked).
// Sizes below are the board's pixel sizes; each SVG scales to whatever width/height CSS gives it.

const INK = "#141414";
const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const MARK_BOX = 330; // the mark is drawn on a 330-unit square centred on 0,0

// Eight pairs of brackets around the centre
function Rays({ fill }) {
    return (
        <g fill={fill}>
            {RAY_ANGLES.map((angle) => (
                <g key={angle} transform={`rotate(${angle}) rotate(90 125 0)`}>
                    <path d="M100,-30 Q76,0 100,30 Q92,0 100,-30 Z" />
                    <path d="M150,-30 Q174,0 150,30 Q158,0 150,-30 Z" />
                </g>
            ))}
        </g>
    );
}

// Places glyph outlines (drawn at font-size 100) at `size`, left edge at x, baseline at y
const letters = (size, x, y) => `translate(${x} ${y}) scale(${size / 100})`;

// "HIIPS" beside the mark, with "360" in the middle of it.
// color: wordmark and rays. White on orange (header), orange on white (light background).
export function LogoLockup({ color = "#ffffff", className }) {
    const wordSize = 132;
    const markSize = 233;
    const numSize = 52 * (MARK_BOX / markSize); // in the mark's own units
    const gap = 24;

    const wordWidth = (HIIPS.width * wordSize) / 100;
    const width = wordWidth + gap + markSize;
    const mid = markSize / 2;

    return (
        <svg className={className} viewBox={`0 0 ${width} ${markSize}`} role="img" aria-label="HIIPS360">
            <path
                d={HIIPS.d}
                fill={color}
                transform={letters(wordSize, 0, mid + (CAP_HEIGHT * wordSize) / 200)}
            />
            <g transform={`translate(${wordWidth + gap + mid} ${mid}) scale(${markSize / MARK_BOX})`}>
                <Rays fill={color} />
                <path
                    d={NUM.d}
                    fill={INK}
                    transform={letters(numSize, (-NUM.width * numSize) / 200, (CAP_HEIGHT * numSize) / 200)}
                />
            </g>
        </svg>
    );
}

// Mark above "HIIPS360". Meant for an orange background: white rays and HIIPS, dark 360.
export function LogoStacked({ className }) {
    const markSize = 231;
    const textSize = 88;
    const gap = 37; // the board's 24px gap plus the text's line-height padding

    const hiipsWidth = (STACK_HIIPS.width * textSize) / 100;
    const textWidth = hiipsWidth - 1 + (STACK_NUM.width * textSize) / 100;
    const width = Math.max(markSize, textWidth);
    const baseline = markSize + gap + (CAP_HEIGHT * textSize) / 100;
    const textLeft = (width - textWidth) / 2;

    return (
        <svg className={className} viewBox={`0 0 ${width} ${baseline}`} role="img" aria-label="HIIPS360">
            <g transform={`translate(${width / 2} ${markSize / 2}) scale(${markSize / MARK_BOX})`}>
                <Rays fill="#ffffff" />
            </g>
            <path d={STACK_HIIPS.d} fill="#ffffff" transform={letters(textSize, textLeft, baseline)} />
            <path d={STACK_NUM.d} fill={INK} transform={letters(textSize, textLeft + hiipsWidth - 1, baseline)} />
        </svg>
    );
}
