/**
 * Shared parser for the mixed text+LaTeX content format used across the app:
 * plain prose interleaved with $...$, $$...$$, \(...\), \[...\] math spans.
 * Used by both the read-only renderer (MathRenderer) and the visual
 * authoring editor (MathExpressionEditor) so the two never drift apart.
 */

const MATH_PATTERN = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n]+?\$|\\\([\s\S]+?\\\))/g;

/**
 * Parses a mixed content string into an ordered list of segments:
 * { type: 'text', value } | { type: 'math', latex, displayMode }
 */
export function parseMixedContent(contentStr) {
    if (!contentStr) return [];

    const segments = [];
    let lastIndex = 0;
    let match;

    const pattern = new RegExp(MATH_PATTERN.source, 'g');
    while ((match = pattern.exec(contentStr)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: 'text', value: contentStr.substring(lastIndex, match.index) });
        }

        let mathExpr = match[0];
        let displayMode = false;

        if (mathExpr.startsWith('$$') && mathExpr.endsWith('$$')) {
            mathExpr = mathExpr.slice(2, -2);
            displayMode = true;
        } else if (mathExpr.startsWith('\\[') && mathExpr.endsWith('\\]')) {
            mathExpr = mathExpr.slice(2, -2);
            displayMode = true;
        } else if (mathExpr.startsWith('$') && mathExpr.endsWith('$')) {
            mathExpr = mathExpr.slice(1, -1);
        } else if (mathExpr.startsWith('\\(') && mathExpr.endsWith('\\)')) {
            mathExpr = mathExpr.slice(2, -2);
        }

        segments.push({ type: 'math', latex: mathExpr, displayMode });
        lastIndex = pattern.lastIndex;
    }

    if (lastIndex < contentStr.length) {
        segments.push({ type: 'text', value: contentStr.substring(lastIndex) });
    }

    return segments;
}

/**
 * Serializes segments back into the stored string format.
 * Math segments are wrapped in $...$ (or $$...$$ for display mode).
 */
export function stringifyMixedContent(segments) {
    return segments.map(seg => {
        if (seg.type === 'text') return seg.value;
        const delim = seg.displayMode ? '$$' : '$';
        return `${delim}${seg.latex}${delim}`;
    }).join('');
}

/** Heuristic used only to pick a sensible default UI state, never to enforce behavior. */
export function looksLikeMathContent(str) {
    if (!str) return false;
    return /\$[^\$\n]+\$|\$\$[\s\S]+?\$\$|\\\(|\\\[/.test(str);
}
