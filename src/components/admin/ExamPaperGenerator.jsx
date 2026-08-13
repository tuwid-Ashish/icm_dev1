import React, { useState, useEffect, useMemo } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { MathRenderer } from '../common/MathRenderer.jsx';
import { EXAM_BATCHES } from '../../constants/examBatches.js';
import { looksLikeMathContent } from '../../utils/mathContent.js';

/**
 * Lets an admin filter/sort the question bank and print a paper-formatted
 * exam to PDF (via the browser's own print engine — "Save as PDF" in the
 * print dialog) for offline students. Reuses MathRenderer so math/Marathi
 * text/images render with the exact same fidelity as everywhere else in
 * the app, rather than a screenshot-based PDF library.
 */
export const ExamPaperGenerator = () => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedBatches, setSelectedBatches] = useState([...EXAM_BATCHES]);
    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const [questionTypeFilter, setQuestionTypeFilter] = useState('all');
    const [sortBy, setSortBy] = useState('subject');
    const [questionLimit, setQuestionLimit] = useState('');
    const [includeAnswerKey, setIncludeAnswerKey] = useState(false);

    // Explicit hand-picked question ids — the filters above narrow the
    // candidate pool, this is what actually decides what goes in the paper.
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [pickerSearch, setPickerSearch] = useState('');
    const [pickerShowMode, setPickerShowMode] = useState('all'); // 'all' | 'selected'
    const [quickPickCount, setQuickPickCount] = useState(10);

    const [paperTitle, setPaperTitle] = useState('Practice Exam Paper');
    const [duration, setDuration] = useState('90 Minutes');
    const [instructions, setInstructions] = useState('All questions are compulsory. Each question carries equal marks unless stated otherwise.');

    useEffect(() => {
        (async () => {
            setLoading(true);
            const loaded = await firestoreEngine.getQuestions('ALL');
            setQuestions(loaded);
            setLoading(false);
        })();
    }, []);

    const availableSubjects = useMemo(() => {
        const set = new Set();
        questions.forEach(q => { if (q.subject) set.add(q.subject); });
        return Array.from(set).sort();
    }, [questions]);

    // Default to "all subjects selected" once we know what subjects exist.
    useEffect(() => {
        if (availableSubjects.length > 0 && selectedSubjects.length === 0) {
            setSelectedSubjects(availableSubjects);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [availableSubjects]);

    const toggleInArray = (arr, setArr, value) => {
        setArr(arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
    };

    // Candidate pool: everything matching the batch/subject/type filters.
    // This is what the hand-pick list below shows — filters narrow the
    // pool, they don't decide what's in the paper by themselves anymore.
    const candidateQuestions = useMemo(() => {
        return questions.filter(q => {
            const qBatches = Array.isArray(q.batches) ? q.batches : (q.batch ? q.batch.split(', ') : []);
            const batchMatch = qBatches.includes('ALL') || qBatches.some(b => selectedBatches.includes(b));
            // No "empty means match-all" escape hatch here on purpose — the
            // "None" button sets this to [], and it should mean exactly
            // that (show nothing) rather than silently matching everything.
            // Initial population to "all subjects" happens once via the
            // effect below, before the admin has touched anything.
            const subjectMatch = selectedSubjects.includes(q.subject);
            // questionType is only set on questions authored through the
            // newer math editor — most legacy/bulk-imported questions never
            // got it set even when their text does contain LaTeX. Falling
            // back to content-sniffing (the same heuristic QuestionBankManager
            // uses to pick a default edit mode) so "Mathematical" actually
            // finds them instead of only the handful with the field set.
            const isMathematical = q.questionType === 'mathematical' || looksLikeMathContent(q.text);
            const typeMatch = questionTypeFilter === 'all' || (questionTypeFilter === 'mathematical' ? isMathematical : !isMathematical);
            return batchMatch && subjectMatch && typeMatch;
        });
    }, [questions, selectedBatches, selectedSubjects, questionTypeFilter]);

    // Whenever the filters change (new candidate pool), default to
    // everything selected — admin can then uncheck individual questions,
    // or hit "Deselect All" and hand-pick from scratch.
    useEffect(() => {
        setSelectedIds(new Set(candidateQuestions.map(q => q.id)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [candidateQuestions]);

    const toggleQuestionSelected = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // Picker list grouped by subject — mirrors how an admin actually builds
    // a paper ("10 from Maths, 5 from Reasoning...") instead of one long
    // undifferentiated list. Each group carries its own selected/total count
    // and quick-action buttons.
    const pickerGroups = useMemo(() => {
        const term = pickerSearch.trim().toLowerCase();
        const bySubject = new Map();

        candidateQuestions.forEach(q => {
            if (term && !(q.text || '').toLowerCase().includes(term) && !(q.subject || '').toLowerCase().includes(term)) return;
            if (pickerShowMode === 'selected' && !selectedIds.has(q.id)) return;
            const subject = q.subject || 'General';
            if (!bySubject.has(subject)) bySubject.set(subject, []);
            bySubject.get(subject).push(q);
        });

        return Array.from(bySubject.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([subject, list]) => ({
                subject,
                questions: list,
                selectedCount: list.filter(q => selectedIds.has(q.id)).length
            }));
    }, [candidateQuestions, pickerSearch, pickerShowMode, selectedIds]);

    const selectionBySubject = useMemo(() => {
        const map = new Map();
        candidateQuestions.forEach(q => {
            if (!selectedIds.has(q.id)) return;
            const subject = q.subject || 'General';
            const entry = map.get(subject) || { count: 0, marks: 0 };
            entry.count += 1;
            entry.marks += q.marks || 1;
            map.set(subject, entry);
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [candidateQuestions, selectedIds]);

    const setSubjectGroupSelection = (subjectQuestions, shouldSelect) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            subjectQuestions.forEach(q => { shouldSelect ? next.add(q.id) : next.delete(q.id); });
            return next;
        });
    };

    const quickPickFromSubject = (subjectQuestions, count) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            let added = 0;
            for (const q of subjectQuestions) {
                if (added >= count) break;
                if (!next.has(q.id)) { next.add(q.id); added++; }
            }
            return next;
        });
    };

    const finalQuestions = useMemo(() => {
        let list = candidateQuestions.filter(q => selectedIds.has(q.id));

        list = [...list].sort((a, b) => {
            if (sortBy === 'marks') return (b.marks || 1) - (a.marks || 1);
            if (sortBy === 'updatedAt') return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
            return (a.subject || '').localeCompare(b.subject || '');
        });

        const limit = parseInt(questionLimit, 10);
        if (limit > 0) list = list.slice(0, limit);

        return list;
    }, [candidateQuestions, selectedIds, sortBy, questionLimit]);

    const totalMarks = finalQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);

    const handleDownloadPdf = () => {
        window.print();
    };

    return (
        <div>
            {/* Filter/Sort Panel — hidden when printing */}
            <div className="card no-print">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Exam Paper Generator</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Filter to narrow the pool, hand-pick exactly which questions to include, then download a print-ready PDF for offline students.
                        </p>
                    </div>
                    <button className="btn btn-primary" onClick={handleDownloadPdf} disabled={finalQuestions.length === 0}>
                        📄 Download PDF ({finalQuestions.length} Questions · {totalMarks} Marks)
                    </button>
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    💡 In the print dialog: set Destination to "Save as PDF", and turn off "Headers and footers" (in More Settings) — that setting is what prints the URL/date/page-number line, and it's controlled by your browser, not this page.
                </p>

                <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Paper Title</label>
                        <input type="text" className="form-control" value={paperTitle} onChange={e => setPaperTitle(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Duration</label>
                        <input type="text" className="form-control" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 90 Minutes" />
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Instructions</label>
                    <textarea className="form-control" style={{ minHeight: '60px' }} value={instructions} onChange={e => setInstructions(e.target.value)} />
                </div>

                <div className="form-grid-2col" style={{ marginBottom: '1rem', alignItems: 'start' }}>
                    <div className="form-group">
                        <label className="form-label">Exam Batches</label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {EXAM_BATCHES.map(b => (
                                <button
                                    key={b}
                                    type="button"
                                    onClick={() => toggleInArray(selectedBatches, setSelectedBatches, b)}
                                    style={{
                                        padding: '0.35rem 0.8rem', borderRadius: 'var(--radius-full)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                        border: selectedBatches.includes(b) ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                        background: selectedBatches.includes(b) ? 'var(--primary-light)' : 'var(--bg-surface)',
                                        color: selectedBatches.includes(b) ? 'var(--primary)' : 'var(--text-secondary)'
                                    }}
                                >
                                    {b}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Subjects</span>
                            <span style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedSubjects(availableSubjects)}>All</button>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedSubjects([])}>None</button>
                            </span>
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {availableSubjects.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => toggleInArray(selectedSubjects, setSelectedSubjects, s)}
                                    style={{
                                        padding: '0.35rem 0.8rem', borderRadius: 'var(--radius-full)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                        border: selectedSubjects.includes(s) ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                        background: selectedSubjects.includes(s) ? 'var(--primary-light)' : 'var(--bg-surface)',
                                        color: selectedSubjects.includes(s) ? 'var(--primary)' : 'var(--text-secondary)'
                                    }}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="form-grid-3col" style={{ marginBottom: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Question Type</label>
                        <select className="form-control" value={questionTypeFilter} onChange={e => setQuestionTypeFilter(e.target.value)}>
                            <option value="all">All Types</option>
                            <option value="standard">Standard</option>
                            <option value="mathematical">Mathematical</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Paper Order</label>
                        <select className="form-control" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                            <option value="subject">Group by Subject</option>
                            <option value="marks">Marks (High to Low)</option>
                            <option value="updatedAt">Recently Updated</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Limit Total Questions (optional)</label>
                        <input type="number" min="1" className="form-control" value={questionLimit} onChange={e => setQuestionLimit(e.target.value)} placeholder="All selected" />
                    </div>
                </div>

                {/* Running selection summary — visibility into what's been
                    picked so far without having to scroll the whole list. */}
                <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.88rem' }}>
                            {selectedIds.size} questions selected · {[...selectedIds].reduce((sum, id) => {
                                const q = candidateQuestions.find(cq => cq.id === id);
                                return sum + (q?.marks || 1);
                            }, 0)} marks
                        </strong>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button type="button" className={`btn btn-sm ${pickerShowMode === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPickerShowMode('all')}>Show All</button>
                            <button type="button" className={`btn btn-sm ${pickerShowMode === 'selected' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPickerShowMode('selected')}>Show Selected Only</button>
                        </div>
                    </div>
                    {selectionBySubject.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                            {selectionBySubject.map(([subject, { count, marks }]) => (
                                <span key={subject} style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                    {subject}: {count} ({marks}M)
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Hand-pick exactly which questions go in, grouped by subject
                    with per-subject quick actions — the filters above just
                    narrow this list down to a manageable pool to pick from. */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span>Select Questions</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 400 }}>
                            Quick-pick
                            <input
                                type="number" min="1" className="form-control" style={{ width: '4.5rem', padding: '0.25rem 0.5rem' }}
                                value={quickPickCount}
                                onChange={e => setQuickPickCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            />
                            per subject below
                        </span>
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        style={{ marginBottom: '0.5rem' }}
                        placeholder="Search question text or subject to narrow this list..."
                        value={pickerSearch}
                        onChange={e => setPickerSearch(e.target.value)}
                    />
                    <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                        {pickerGroups.length === 0 ? (
                            <p style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No questions match.</p>
                        ) : (
                            pickerGroups.map(group => (
                                <div key={group.subject}>
                                    <div style={{
                                        position: 'sticky', top: 0, zIndex: 1,
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem',
                                        background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)',
                                        padding: '0.4rem 0.75rem', fontSize: '0.82rem', fontWeight: 800
                                    }}>
                                        <span>{group.subject} ({group.selectedCount}/{group.questions.length})</span>
                                        <span style={{ display: 'flex', gap: '0.35rem' }}>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => quickPickFromSubject(group.questions, quickPickCount)}>
                                                Pick {quickPickCount}
                                            </button>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSubjectGroupSelection(group.questions, true)}>All</button>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSubjectGroupSelection(group.questions, false)}>None</button>
                                        </span>
                                    </div>
                                    {group.questions.map(q => (
                                        <label
                                            key={q.id}
                                            style={{
                                                display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                                                padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)',
                                                fontSize: '0.85rem', cursor: 'pointer',
                                                background: selectedIds.has(q.id) ? 'var(--bg-subtle)' : 'transparent'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                style={{ marginTop: '0.2rem', flexShrink: 0 }}
                                                checked={selectedIds.has(q.id)}
                                                onChange={() => toggleQuestionSelected(q.id)}
                                            />
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                {(q.questionType === 'mathematical' || looksLikeMathContent(q.text)) && <span title="Contains math" style={{ marginRight: '0.3rem' }}>Σ</span>}
                                                {(q.text || '').slice(0, 110)}{(q.text || '').length > 110 ? '…' : ''}
                                            </span>
                                            <span style={{ flexShrink: 0, color: 'var(--text-muted)', fontWeight: 700 }}>{q.marks || 1}M</span>
                                        </label>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeAnswerKey} onChange={e => setIncludeAnswerKey(e.target.checked)} />
                    Include Answer Key (correct options highlighted + explanations shown)
                </label>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Leave this off to print a clean student copy. Turn it on and print again separately to produce the answer key for yourself.
                </p>
            </div>

            {/* Printable Paper Preview */}
            <div className="card exam-paper-print-area" style={{ marginTop: '1.5rem' }}>
                {loading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Loading question bank...</p>
                ) : finalQuestions.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No questions selected — pick some above.</p>
                ) : (
                    <>
                        <div className="exam-paper-header" style={{ textAlign: 'center', borderBottom: '2px solid var(--border-strong)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.5rem' }}>{paperTitle}</h2>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '0.9rem', fontWeight: 700, marginTop: '0.5rem' }}>
                                <span>Duration: {duration}</span>
                                <span>Total Questions: {finalQuestions.length}</span>
                                <span>Total Marks: {totalMarks}</span>
                            </div>
                            {instructions && (
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.75rem', textAlign: 'left' }}>
                                    <strong>Instructions:</strong> {instructions}
                                </p>
                            )}
                            {includeAnswerKey && (
                                <div style={{ marginTop: '0.5rem', fontWeight: 800, color: 'var(--danger)', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                                    — ANSWER KEY COPY —
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {finalQuestions.map((q, idx) => {
                                const correctIdx = q.correctIndex !== undefined ? q.correctIndex : q.correctOption;
                                const NUM_COL = '1.9rem';
                                const LETTER_COL = '1.4rem';
                                return (
                                    <div key={q.id} className="exam-paper-question">
                                        {/* Question row: number in a fixed-width column (hanging indent),
                                            marks pinned to the right — MathRenderer always renders a block
                                            <div>, so it can't sit inline after "1." the way plain text could;
                                            a flex row with a fixed-width label column is what lets numbering
                                            and content align cleanly instead of stacking on separate lines. */}
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                            <strong style={{ flex: `0 0 ${NUM_COL}` }}>{idx + 1}.</strong>
                                            <div style={{ flex: '1 1 auto', fontWeight: 700, minWidth: 0 }}>
                                                <MathRenderer text={q.text} imageUrl={q.imageUrl} images={q.questionImages} />
                                            </div>
                                            <span style={{ flex: '0 0 auto', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap', paddingTop: '0.1rem' }}>
                                                [{q.marks || 1} Marks]
                                            </span>
                                        </div>

                                        {/* Options: same hanging-indent pattern, aligned under the question text column */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '1.25rem', rowGap: '0.3rem', marginTop: '0.35rem', paddingLeft: `calc(${NUM_COL} + 0.5rem)`, fontSize: '0.92rem' }}>
                                            {(q.options || []).map((opt, optIdx) => {
                                                const isCorrect = includeAnswerKey && optIdx === correctIdx;
                                                return (
                                                    <div key={optIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                                                        <span style={{ flex: `0 0 ${LETTER_COL}`, fontWeight: isCorrect ? 800 : 600, color: isCorrect ? 'var(--success)' : 'inherit' }}>
                                                            {String.fromCharCode(65 + optIdx)})
                                                        </span>
                                                        <div style={{ flex: '1 1 auto', minWidth: 0, fontWeight: isCorrect ? 800 : 400, color: isCorrect ? 'var(--success)' : 'inherit' }}>
                                                            <MathRenderer text={opt} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {includeAnswerKey && q.explanation && (
                                            <div style={{ marginTop: '0.4rem', marginLeft: `calc(${NUM_COL} + 0.5rem)`, fontSize: '0.82rem', color: 'var(--text-secondary)', borderLeft: '3px solid var(--primary)', paddingLeft: '0.6rem' }}>
                                                <strong>Explanation:</strong> <MathRenderer text={q.explanation} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
