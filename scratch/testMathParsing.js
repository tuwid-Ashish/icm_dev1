import katex from 'katex';

function parseAndRenderMath(rawInput) {
    if (!rawInput) return '';

    // Fix common string escaping artifacts (like \f becoming formfeed \x0C)
    let cleaned = rawInput.replace(/\f/g, '\\f').replace(/\b/g, '\\b');

    // Regex to split by $...$, $$...$$, \(...\), \[...\]
    const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n]+?\$|\\\([\s\S]+?\\\))/g;

    let parts = [];
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(cleaned)) !== null) {
        if (match.index > lastIdx) {
            parts.push({ type: 'text', content: cleaned.substring(lastIdx, match.index) });
        }
        let expr = match[0];
        let displayMode = false;
        if (expr.startsWith('$$') || expr.startsWith('\\[')) {
            displayMode = true;
            expr = expr.slice(2, -2);
        } else {
            expr = expr.slice(1, -1);
        }
        parts.push({ type: 'math', content: expr, displayMode });
        lastIdx = regex.lastIndex;
    }

    if (lastIdx < cleaned.length) {
        parts.push({ type: 'text', content: cleaned.substring(lastIdx) });
    }

    // If no $ math tags were found, but LaTeX commands like \frac, \sqrt, \pm exist, wrap and render
    if (parts.length === 1 && parts[0].type === 'text') {
        const text = parts[0].content;
        if (/\\(frac|sqrt|pm|times|div|leq|geq|neq|alpha|beta|theta|pi|Delta|sum|int|sin|cos|tan)/.test(text)) {
            try {
                return katex.renderToString(text, { throwOnError: false, displayMode: false });
            } catch (e) {
                console.error('KaTeX error:', e.message);
            }
        }
    }

    return parts.map(p => {
        if (p.type === 'text') return p.content;
        try {
            return katex.renderToString(p.content, { throwOnError: false, displayMode: p.displayMode });
        } catch (e) {
            return `[Math Error: ${p.content}]`;
        }
    }).join(' ');
}

console.log('--- Test 1 ---');
console.log(parseAndRenderMath('Calculate the value of $\\frac{2^5 \\times 2^3}{2^4}$.'));

console.log('--- Test 2 ---');
console.log(parseAndRenderMath('If speed $v = 60\\text{ km/h}$, find distance traveled in $t = 2.5\\text{ hours}$ using $d = v \\times t$.'));

console.log('--- Test 3 ---');
console.log(parseAndRenderMath('Solve for $x$ using quadratic formula $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$ for $x^2 + 4x + 4 = 0$.'));
