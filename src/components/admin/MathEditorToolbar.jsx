import React, { useState } from 'react';
import { MathRenderer } from '../common/MathRenderer.jsx';

/**
 * Visual Mathematical Toolbar & Formula Builder for Admin Question Authoring
 * Allows admins to insert fractions, roots, powers, Greek letters, and formulas cleanly.
 */
export const MathEditorToolbar = ({ onInsertMath, targetFieldName = 'Field' }) => {
    const [customLatex, setCustomLatex] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const mathSnippets = [
        { label: 'Fraction (अपूर्णांक)', code: '\\frac{a}{b}', preview: '$\\frac{a}{b}$' },
        { label: 'Square Root (वर्गमूळ)', code: '\\sqrt{x}', preview: '$\\sqrt{x}$' },
        { label: 'Exponent (घात)', code: 'x^{2}', preview: '$x^{2}$' },
        { label: 'Subscript (पाया)', code: 'a_{1}', preview: '$a_{1}$' },
        { label: 'Plus/Minus (±)', code: '\\pm', preview: '$\\pm$' },
        { label: 'Multiply (×)', code: '\\times', preview: '$\\times$' },
        { label: 'Divide (÷)', code: '\\div', preview: '$\\div$' },
        { label: 'Less/Equal (≤)', code: '\\leq', preview: '$\\leq$' },
        { label: 'Greater/Equal (≥)', code: '\\geq', preview: '$\\geq$' },
        { label: 'Not Equal (≠)', code: '\\neq', preview: '$\\neq$' },
        { label: 'Alpha (α)', code: '\\alpha', preview: '$\\alpha$' },
        { label: 'Beta (β)', code: '\\beta', preview: '$\\beta$' },
        { label: 'Theta (θ)', code: '\\theta', preview: '$\\theta$' },
        { label: 'Pi (π)', code: '\\pi', preview: '$\\pi$' },
        { label: 'Delta (Δ)', code: '\\Delta', preview: '$\\Delta$' },
        { label: 'Summation (Σ)', code: '\\sum_{i=1}^{n}', preview: '$\\sum_{i=1}^{n}$' },
        { label: 'Integration (∫)', code: '\\int_{a}^{b}', preview: '$\\int_{a}^{b}$' },
        { label: 'Sine (sin)', code: '\\sin\\theta', preview: '$\\sin\\theta$' },
        { label: 'Cosine (cos)', code: '\\cos\\theta', preview: '$\\cos\\theta$' },
        { label: 'Tangent (tan)', code: '\\tan\\theta', preview: '$\\tan\\theta$' },
        { label: 'Trig Identity', code: '\\sin^2\\theta + \\cos^2\\theta = 1', preview: '$\\sin^2\\theta + \\cos^2\\theta = 1$' },
        { label: 'Quadratic Formula', code: '\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', preview: '$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$' }
    ];

    const handleInsertSnippet = (code) => {
        const mathToken = `$${code}$`;
        if (onInsertMath) {
            onInsertMath(mathToken);
        }
    };

    const handleInsertCustom = (e) => {
        e.preventDefault();
        if (!customLatex.trim()) return;
        const formattedToken = customLatex.trim().startsWith('$') ? customLatex.trim() : `$${customLatex.trim()}$`;
        if (onInsertMath) {
            onInsertMath(formattedToken);
        }
        setCustomLatex('');
    };

    return (
        <div style={{ background: 'var(--bg-subtle)', border: '1px dashed var(--primary)', borderRadius: 'var(--radius-md)', padding: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>∑</span> Visual Math Formula Builder (गणितीय सूत्र संपादक) for <u>{targetFieldName}</u>
                </div>
                <button 
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? '▲ Hide Math Toolbar' : '▼ Insert Math Symbols'}
                </button>
            </div>

            {isExpanded && (
                <div>
                    {/* Symbol Shortcut Buttons */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                        {mathSnippets.map((item, idx) => (
                            <button
                                key={idx}
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem', background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                                title={`Insert ${item.label}`}
                                onClick={() => handleInsertSnippet(item.code)}
                            >
                                <MathRenderer text={item.preview} />
                            </button>
                        ))}
                    </div>

                    {/* Custom LaTeX Input Box with Live Preview */}
                    <form onSubmit={handleInsertCustom} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Type custom LaTeX (e.g. \frac{x^2+1}{x-1} or \sqrt{x+y})..."
                            value={customLatex}
                            onChange={(e) => setCustomLatex(e.target.value)}
                            style={{ fontSize: '0.85rem' }}
                        />
                        <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
                            + Insert Math
                        </button>
                    </form>

                    {/* Live Preview Box */}
                    {customLatex.trim() && (
                        <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.75rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Live Equation Preview:</span>
                            <MathRenderer text={customLatex.trim().startsWith('$') ? customLatex.trim() : `$${customLatex.trim()}$`} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
