import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'mathlive';
import { parseMixedContent, stringifyMixedContent } from '../../utils/mathContent.js';

let segIdCounter = 0;
const nextSegId = () => `seg-${++segIdCounter}`;

function segmentsFromValue(value) {
    const parsed = parseMixedContent(value || '');
    if (parsed.length === 0) {
        return [{ id: nextSegId(), type: 'text', value: '' }];
    }
    return parsed.map(p => ({ id: nextSegId(), ...p }));
}

/** A single inline MathLive mathfield, wired imperatively since it's a custom element. */
const MathFieldSegment = ({ latex, onLatexChange, onFocus, onRemove }) => {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (el.value !== latex) el.value = latex;

        const handleInput = () => onLatexChange(el.value);
        const handleFocusEvt = () => onFocus && onFocus(el);
        el.addEventListener('input', handleInput);
        el.addEventListener('focus', handleFocusEvt);
        return () => {
            el.removeEventListener('input', handleInput);
            el.removeEventListener('focus', handleFocusEvt);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onLatexChange, onFocus]);

    useEffect(() => {
        const el = ref.current;
        if (el && el.value !== latex) el.value = latex;
    }, [latex]);

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--primary-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.1rem 0.3rem',
                margin: '0.15rem'
            }}
        >
            {/* eslint-disable-next-line react/no-unknown-property */}
            <math-field
                ref={ref}
                data-math-segment="true"
                style={{ minWidth: '32px', fontSize: '1rem' }}
                virtual-keyboard-mode="onfocus"
                smart-fence="on"
            />
            <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onRemove}
                title="Remove equation"
                style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1, padding: '0 0.15rem' }}
            >
                ×
            </button>
        </span>
    );
};

/**
 * Reusable visual editor for mixed prose + math content.
 * Renders a flex-wrapped row of plain text inputs interleaved with
 * inline MathLive mathfields. Text segments use native <input> so
 * selectionStart/selectionEnd give exact cursor position for splitting.
 */
export const MathExpressionEditor = ({ value = '', onChange, placeholder = '', minHeight = '2.6rem', onMathFieldFocus }) => {
    const [segments, setSegments] = useState(() => segmentsFromValue(value));
    const lastEmitted = useRef(value);
    const focusedTextInput = useRef(null); // { segId, el }
    const pendingFocusMathId = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (value !== lastEmitted.current) {
            setSegments(segmentsFromValue(value));
            lastEmitted.current = value;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    useEffect(() => {
        if (pendingFocusMathId.current && containerRef.current) {
            const el = containerRef.current.querySelector(`[data-seg-id="${pendingFocusMathId.current}"] math-field`);
            if (el && el.focus) el.focus();
            pendingFocusMathId.current = null;
        }
    });

    const commit = useCallback((newSegments) => {
        setSegments(newSegments);
        // \placeholder{} is a MathLive-only authoring affordance (renders as a
        // dashed "click here" box while editing an empty template slot). KaTeX
        // doesn't understand the command, so any slot still unfilled when the
        // value leaves this editor is stripped down to a plain empty group —
        // otherwise both the live preview and the student view would show the
        // literal text "\placeholder" instead of a blank/rendered equation.
        // Empty math segments (inserted but not yet filled in) are also
        // omitted from the emitted string — a bare "$$" is ambiguous to
        // re-parse and would render as literal text. They stay in the
        // internal `segments` state above so the empty mathfield box
        // remains visible and editable in the UI until the author fills
        // it in or removes it.
        const str = stringifyMixedContent(
            newSegments
                .filter(s => s.type !== 'math' || (s.latex && s.latex.trim() !== ''))
                .map(({ id, ...rest }) => rest)
        ).replace(/\\placeholder\{\}/g, '');
        lastEmitted.current = str;
        onChange && onChange(str);
    }, [onChange]);

    const updateTextSegment = (segId, newValue) => {
        commit(segments.map(s => (s.id === segId ? { ...s, value: newValue } : s)));
    };

    const updateMathSegment = (segId, newLatex) => {
        commit(segments.map(s => (s.id === segId ? { ...s, latex: newLatex } : s)));
    };

    const removeMathSegment = (segId) => {
        commit(segments.filter(s => s.id !== segId));
    };

    const handleInsertMath = () => {
        let newSegments;
        let newMathId = nextSegId();

        const focused = focusedTextInput.current;
        if (focused && segments.some(s => s.id === focused.segId)) {
            const seg = segments.find(s => s.id === focused.segId);
            const cursor = focused.el && typeof focused.el.selectionStart === 'number' ? focused.el.selectionStart : seg.value.length;
            const left = seg.value.slice(0, cursor);
            const right = seg.value.slice(cursor);
            newSegments = [];
            segments.forEach(s => {
                if (s.id === seg.id) {
                    newSegments.push({ id: nextSegId(), type: 'text', value: left });
                    newSegments.push({ id: newMathId, type: 'math', latex: '', displayMode: false });
                    newSegments.push({ id: nextSegId(), type: 'text', value: right });
                } else {
                    newSegments.push(s);
                }
            });
        } else {
            newSegments = [...segments, { id: newMathId, type: 'math', latex: '', displayMode: false }, { id: nextSegId(), type: 'text', value: '' }];
        }

        pendingFocusMathId.current = newMathId;
        commit(newSegments);
    };

    return (
        <div>
            <div
                ref={containerRef}
                className="math-expr-editor"
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '0.1rem',
                    minHeight,
                    padding: '0.5rem 0.6rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)'
                }}
            >
                {segments.map((seg, idx) => {
                    if (seg.type === 'math') {
                        return (
                            <span key={seg.id} data-seg-id={seg.id}>
                                <MathFieldSegment
                                    latex={seg.latex}
                                    onLatexChange={(latex) => updateMathSegment(seg.id, latex)}
                                    onFocus={(el) => onMathFieldFocus && onMathFieldFocus(el)}
                                    onRemove={() => removeMathSegment(seg.id)}
                                />
                            </span>
                        );
                    }
                    return (
                        <input
                            key={seg.id}
                            type="text"
                            value={seg.value}
                            placeholder={segments.length === 1 ? placeholder : ''}
                            onChange={(e) => updateTextSegment(seg.id, e.target.value)}
                            onFocus={(e) => { focusedTextInput.current = { segId: seg.id, el: e.target }; }}
                            style={{
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                fontSize: '0.95rem',
                                fontFamily: 'inherit',
                                color: 'var(--text-primary)',
                                flex: seg.value ? `0 1 auto` : '1 0 40px',
                                minWidth: '2ch',
                                width: `${Math.max((seg.value || placeholder || '').length, 2)}ch`
                            }}
                        />
                    );
                })}
            </div>
            <button
                type="button"
                className="btn btn-secondary btn-sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleInsertMath}
                style={{ marginTop: '0.4rem', fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
            >
                Σ + Insert Math Here
            </button>
        </div>
    );
};
