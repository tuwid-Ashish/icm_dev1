import React, { useState } from 'react';

/**
 * Toolbar that inserts structured LaTeX templates into whichever MathLive
 * mathfield last had focus (tracked via activeMathFieldRef, shared across
 * every MathExpressionEditor instance in the modal). Buttons never touch a
 * plain textarea directly — the author always edits the resulting structure
 * visually inside the mathfield, never raw LaTeX text.
 */

const BASIC = [
    { label: '±', latex: '\\pm' },
    { label: '×', latex: '\\times' },
    { label: '÷', latex: '\\div' },
    { label: '=', latex: '=' },
    { label: '≠', latex: '\\neq' },
    { label: '<', latex: '<' },
    { label: '>', latex: '>' },
    { label: '≤', latex: '\\leq' },
    { label: '≥', latex: '\\geq' }
];

const STRUCTURE = [
    { label: 'a/b', title: 'Fraction', latex: '\\frac{\\placeholder{}}{\\placeholder{}}' },
    { label: '√x', title: 'Square Root', latex: '\\sqrt{\\placeholder{}}' },
    { label: 'ⁿ√x', title: 'Nth Root', latex: '\\sqrt[\\placeholder{}]{\\placeholder{}}' },
    { label: 'x²', title: 'Exponent', latex: '^{\\placeholder{}}' },
    { label: 'x₁', title: 'Subscript', latex: '_{\\placeholder{}}' },
    { label: '( )', title: 'Parentheses', latex: '\\left(\\placeholder{}\\right)' },
    { label: '| |', title: 'Absolute Value', latex: '\\left|\\placeholder{}\\right|' }
];

const GREEK = [
    { label: 'α', latex: '\\alpha' },
    { label: 'β', latex: '\\beta' },
    { label: 'γ', latex: '\\gamma' },
    { label: 'θ', latex: '\\theta' },
    { label: 'π', latex: '\\pi' },
    { label: 'λ', latex: '\\lambda' },
    { label: 'μ', latex: '\\mu' },
    { label: 'Δ', latex: '\\Delta' }
];

const CALCULUS = [
    { label: 'Σ', title: 'Summation', latex: '\\sum_{\\placeholder{}}^{\\placeholder{}}' },
    { label: '∫', title: 'Integral', latex: '\\int_{\\placeholder{}}^{\\placeholder{}}' },
    { label: '∂', title: 'Partial', latex: '\\partial' },
    { label: 'lim', title: 'Limit', latex: '\\lim_{\\placeholder{}}' }
];

const TRIG = [
    { label: 'sin', latex: '\\sin' },
    { label: 'cos', latex: '\\cos' },
    { label: 'tan', latex: '\\tan' },
    { label: 'cot', latex: '\\cot' },
    { label: 'log', latex: '\\log' },
    { label: 'ln', latex: '\\ln' }
];

const TEMPLATES = [
    { label: 'Quadratic Formula', latex: 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}' },
    { label: 'Pythagorean Identity', latex: '\\sin^2\\theta+\\cos^2\\theta=1' }
];

const GROUPS = [
    { key: 'greek', title: 'Greek', items: GREEK },
    { key: 'calc', title: 'Calculus', items: CALCULUS },
    { key: 'trig', title: 'Trigonometry', items: TRIG },
    { key: 'templates', title: 'Formula Templates', items: TEMPLATES }
];

const ToolbarButton = ({ item, onInsert }) => (
    <button
        type="button"
        className="btn btn-secondary btn-sm"
        title={item.title || item.label}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onInsert(item.latex)}
        style={{ fontSize: '0.85rem', padding: '0.3rem 0.55rem', minWidth: '2.2rem' }}
    >
        {item.label}
    </button>
);

export const MathToolbar = ({ activeMathFieldRef }) => {
    const [moreOpen, setMoreOpen] = useState(false);
    const [activeGroup, setActiveGroup] = useState('greek');

    const handleInsert = (latex) => {
        // document.activeElement is the source of truth: every toolbar button
        // uses onMouseDown preventDefault specifically so the mathfield never
        // loses focus when a button is clicked, so this is reliably still the
        // field the author was just editing. activeMathFieldRef is only a
        // fallback for the (rare) case focus landed elsewhere — it can go
        // stale across a modal close/reopen since the old mathfield DOM node
        // gets unmounted without clearing the ref.
        const active = document.activeElement;
        const mf = (active && active.tagName === 'MATH-FIELD') ? active : (activeMathFieldRef && activeMathFieldRef.current);
        if (!mf) return;
        mf.insert(latex, { focus: true, selectionMode: 'placeholder' });
    };

    return (
        <div style={{ background: 'var(--bg-subtle)', border: '1px dashed var(--primary)', borderRadius: 'var(--radius-md)', padding: '0.65rem', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.4rem' }}>
                Σ Math Tools — click into an equation, then choose a symbol to insert
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.35rem' }}>
                {STRUCTURE.map((item, i) => <ToolbarButton key={i} item={item} onInsert={handleInsert} />)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {BASIC.map((item, i) => <ToolbarButton key={i} item={item} onInsert={handleInsert} />)}
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setMoreOpen(!moreOpen)}
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                >
                    {moreOpen ? '▲ Fewer' : '▼ More (Greek, Calculus, Trig, Templates)'}
                </button>
            </div>

            {moreOpen && (
                <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        {GROUPS.map(g => (
                            <button
                                key={g.key}
                                type="button"
                                className={`btn btn-sm ${activeGroup === g.key ? 'btn-primary' : 'btn-secondary'}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setActiveGroup(g.key)}
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                            >
                                {g.title}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {GROUPS.find(g => g.key === activeGroup).items.map((item, i) => (
                            <ToolbarButton key={i} item={item} onInsert={handleInsert} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
