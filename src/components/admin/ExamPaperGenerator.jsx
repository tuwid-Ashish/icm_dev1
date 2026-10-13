import React, { useState, useEffect, useMemo } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { MathRenderer } from '../common/MathRenderer.jsx';
import { EXAM_BATCHES } from '../../constants/examBatches.js';
import { looksLikeMathContent } from '../../utils/mathContent.js';
import { resolveSubjectCode } from '../../constants/subjectCodes.js';
import { indexKey } from '../../utils/questionIndex.js';

// Groups/filters by resolved subject code+name rather than raw q.subject
// text, so spelling variants ("Maths" vs "Mathematics" vs "गणित") collapse
// into one bucket instead of splintering the picker into near-duplicates.
const subjectLabel = (q) => {
    const r = resolveSubjectCode(q.subjectCode || q.subject);
    return `${r.code} — ${r.name}`;
};

const shuffled = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

const PAGE_SIZE = 50;

/**
 * Lets an admin filter/sort the question bank and print a paper-formatted
 * exam to PDF (via the browser's own print engine — "Save as PDF" in the
 * print dialog) for offline students. Reuses MathRenderer so math/Marathi
 * text/images render with the exact same fidelity as everywhere else in
 * the app, rather than a screenshot-based PDF library.
 *
 * The bank is never loaded as a whole. The subject list and totals come from
 * the question index, and questions are fetched only when the admin adds them:
 * "Add N random" fetches just those N, and "Browse" pages through one subject
 * 50 at a time. (This screen used to read every question — one database read
 * each — before showing anything.)
 */
export const ExamPaperGenerator = () => {
    // The questions fetched so far — what the picker lists and the paper is built from.
    const [questions, setQuestions] = useState([]);
    const [counts, setCounts] = useState({});
    // false while the question index is not built: the whole bank is loaded, as before.
    const [indexMode, setIndexMode] = useState(true);
    const [loading, setLoading] = useState(true);
    const [busyCode, setBusyCode] = useState(null);
    const [browse, setBrowse] = useState({});   // { [code]: { cursor, hasMore } }
    const [notice, setNotice] = useState('');

    const [selectedBatches, setSelectedBatches] = useState(['ALL', ...EXAM_BATCHES]);
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
            const [stats] = await Promise.all([
                firestoreEngine.getQuestionStats(),
                firestoreEngine.getSubjectCodes()
            ]);
            setCounts(stats.counts || {});
            if (stats.source === 'index') {
                setIndexMode(true);
            } else {
                // Index not built yet: use the whole bank (already read once by the
                // stats call), pre-selected, exactly as this screen always did.
                setIndexMode(false);
                const all = stats.questions || [];
                setQuestions(all);
                setSelectedIds(new Set(all.map(q => q.id)));
            }
            setLoading(false);
        })();
    }, []);

    const subjectRows = useMemo(() => {
        return Object.entries(counts)
            .map(([code, count]) => {
                const r = resolveSubjectCode(code);
                return {
                    code,
                    count,
                    label: code === 'OTHER' ? 'OTHER — Unmapped' : `${r.code} — ${r.name}`,
                    loaded: questions.filter(q => indexKey(q.subjectCode) === code).length
                };
            })
            .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    }, [counts, questions]);

    const toggleInArray = (arr, setArr, value) => {
        if (value === 'ALL') {
            if (arr.includes('ALL')) {
                setArr([]);
            } else {
                setArr(['ALL', ...EXAM_BATCHES]);
            }
        } else {
            const next = arr.includes(value) ? arr.filter(v => v !== value && v !== 'ALL') : [...arr.filter(v => v !== 'ALL'), value];
            setArr(next.length === EXAM_BATCHES.length ? ['ALL', ...EXAM_BATCHES] : next);
        }
    };

    const typeMatches = (q) => {
        const isMathematical = q.questionType === 'mathematical' || looksLikeMathContent(q.text);
        return questionTypeFilter === 'all' || (questionTypeFilter === 'mathematical' ? isMathematical : !isMathematical);
    };

    // Candidate pool: the fetched questions matching the batch/type filters.
    const candidateQuestions = useMemo(() => {
        return questions.filter(q => {
            const rawBatches = Array.isArray(q.batches) && q.batches.length > 0
                ? q.batches
                : (q.batch ? q.batch.split(/[;,]/) : ['ALL']);

            const qBatches = rawBatches.map(b => (b || '').trim().toLowerCase()).filter(Boolean);

            const isAllSelected = selectedBatches.includes('ALL') || selectedBatches.length === 0;
            const batchMatch = isAllSelected ||
                qBatches.includes('all') ||
                qBatches.some(b => selectedBatches.some(sb => sb.toLowerCase() === b || b.includes(sb.toLowerCase())));

            const isMathematical = q.questionType === 'mathematical' || looksLikeMathContent(q.text);
            const typeMatch = questionTypeFilter === 'all' || (questionTypeFilter === 'mathematical' ? isMathematical : !isMathematical);

            return batchMatch && typeMatch;
        });
    }, [questions, selectedBatches, questionTypeFilter]);

    // Fetch N random questions of one subject and add them, selected. Only those
    // N are read (plus a few spare, so a type filter can still fill the count).
    const addRandom = async (code, n) => {
        setBusyCode(code);
        setNotice('');
        try {
            const loadedIds = new Set(questions.map(q => q.id));
            let picked = [];

            if (indexMode) {
                const index = await firestoreEngine.getQuestionIndexForSubjects([code]);
                const pool = shuffled((index[indexKey(code)] || []).filter(id => !loadedIds.has(id)));
                const spare = questionTypeFilter === 'all' ? 1.2 : 2.5;
                let cursor = 0;
                let rounds = 0;
                while (picked.length < n && cursor < pool.length && rounds < 6) {
                    const need = n - picked.length;
                    const take = Math.min(pool.length - cursor, Math.ceil(need * spare) + 2);
                    const chunk = pool.slice(cursor, cursor + take);
                    cursor += take;
                    rounds++;
                    const docs = await firestoreEngine.getQuestionsByIds(chunk);
                    docs.forEach(q => { if (indexKey(q.subjectCode) === indexKey(code) && typeMatches(q)) picked.push(q); });
                }
                picked = shuffled(picked).slice(0, n);
                if (picked.length > 0) setQuestions(prev => [...prev, ...picked]);
            } else {
                // Whole bank already loaded: choose among the ones not yet selected.
                picked = shuffled(questions.filter(q => indexKey(q.subjectCode) === indexKey(code) && !selectedIds.has(q.id) && typeMatches(q))).slice(0, n);
            }

            if (picked.length === 0) {
                setNotice(`No more matching questions to add for ${code}.`);
                return;
            }
            setSelectedIds(prev => {
                const next = new Set(prev);
                picked.forEach(q => next.add(q.id));
                return next;
            });
            if (picked.length < n) setNotice(`Only ${picked.length} more matching question${picked.length === 1 ? '' : 's'} found for ${code}.`);
        } catch (err) {
            setNotice('Could not fetch questions: ' + (err.message || 'unknown error'));
        } finally {
            setBusyCode(null);
        }
    };

    // Page through one subject, 50 at a time, adding the questions unselected so
    // they can be hand-picked.
    const browseSubject = async (code) => {
        setBusyCode(code);
        setNotice('');
        try {
            const state = browse[code] || { cursor: null, hasMore: true };
            const page = await firestoreEngine.getQuestionPage({ subjectCode: code, pageSize: PAGE_SIZE, cursor: state.cursor });
            setQuestions(prev => {
                const have = new Set(prev.map(q => q.id));
                return [...prev, ...page.questions.filter(q => !have.has(q.id))];
            });
            setBrowse(prev => ({ ...prev, [code]: { cursor: page.cursor, hasMore: page.hasMore } }));
        } catch (err) {
            setNotice('Could not load questions: ' + (err.message || 'unknown error'));
        } finally {
            setBusyCode(null);
        }
    };

    const toggleQuestionSelected = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleSelectAllCandidates = () => {
        setSelectedIds(new Set(candidateQuestions.map(q => q.id)));
    };

    const handleDeselectAll = () => {
        setSelectedIds(new Set());
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
            const subject = subjectLabel(q);
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
            const subject = subjectLabel(q);
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
            return subjectLabel(a).localeCompare(subjectLabel(b));
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
                            Add questions subject by subject (random picks, or browse and hand-pick), then download a print-ready PDF for offline students.
                        </p>
                    </div>
                    <button className="btn btn-primary" onClick={handleDownloadPdf} disabled={finalQuestions.length === 0}>
                        📄 Download PDF ({finalQuestions.length} Questions · {totalMarks} Marks)
                    </button>
                </div>

                {!loading && !indexMode && (
                    <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.82rem' }}>
                        <strong>The question index is not built yet,</strong> so this screen loaded the whole question bank ({questions.length} reads).
                        Build the index from the Question Bank tab to make it load only what you add.
                    </div>
                )}

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

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span>Subjects — add questions</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 400, fontSize: '0.82rem' }}>
                            Random picks add
                            <input
                                type="number" min="1" className="form-control" style={{ width: '4.5rem', padding: '0.25rem 0.5rem' }}
                                value={quickPickCount}
                                onChange={e => setQuickPickCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            />
                            questions
                        </span>
                    </label>
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                        {loading ? (
                            <p style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Loading subjects...</p>
                        ) : subjectRows.length === 0 ? (
                            <p style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No questions found.</p>
                        ) : subjectRows.map(row => (
                            <div key={row.code} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                <span style={{ flex: '1 1 220px', fontWeight: 700, fontSize: '0.85rem' }}>
                                    {row.label}
                                    <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> ({row.count} in the bank · {row.loaded} added)</span>
                                </span>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => addRandom(row.code, quickPickCount)}
                                    disabled={busyCode !== null || row.loaded >= row.count}
                                >
                                    {busyCode === row.code ? 'Adding...' : `Add ${quickPickCount} random`}
                                </button>
                                {indexMode && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => browseSubject(row.code)}
                                        disabled={busyCode !== null || (browse[row.code] && !browse[row.code].hasMore)}
                                    >
                                        {browse[row.code] ? `Browse ${PAGE_SIZE} more` : `Browse ${PAGE_SIZE}`}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    {notice && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>{notice}</p>}
                </div>

                <div className="form-grid-2col" style={{ marginBottom: '1rem', alignItems: 'start' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Exam Batches</span>
                            <span style={{ display: 'flex', gap: '0.4rem' }}>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedBatches(['ALL', ...EXAM_BATCHES])}>All</button>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedBatches([])}>None</button>
                            </span>
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => toggleInArray(selectedBatches, setSelectedBatches, 'ALL')}
                                style={{
                                    padding: '0.35rem 0.8rem', borderRadius: 'var(--radius-full)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                    border: selectedBatches.includes('ALL') ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                    background: selectedBatches.includes('ALL') ? 'var(--primary)' : 'var(--bg-surface)',
                                    color: selectedBatches.includes('ALL') ? '#ffffff' : 'var(--text-secondary)'
                                }}
                            >
                                All Batches
                            </button>
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
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Total Questions Limit</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {questionLimit ? `Cap: ${questionLimit} Qs` : 'Full Selection'}
                            </span>
                        </label>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <input
                                type="number"
                                min="1"
                                className="form-control"
                                value={questionLimit}
                                onChange={e => setQuestionLimit(e.target.value)}
                                placeholder="No limit (All)"
                            />
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuestionLimit('50')}>50</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuestionLimit('100')}>100</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuestionLimit('')}>All</button>
                        </div>
                    </div>
                </div>

                {/* Running selection summary */}
                <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                {finalQuestions.length} Questions in Printable Paper
                            </strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                ({selectedIds.size} selected from {candidateQuestions.length} added · {totalMarks} marks)
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={handleSelectAllCandidates}>
                                Select All Added ({candidateQuestions.length})
                            </button>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={handleDeselectAll}>
                                Clear Selection
                            </button>
                            <button type="button" className={`btn btn-sm ${pickerShowMode === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPickerShowMode('all')}>
                                Show All
                            </button>
                            <button type="button" className={`btn btn-sm ${pickerShowMode === 'selected' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPickerShowMode('selected')}>
                                Show Selected
                            </button>
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

                {/* The questions added so far, grouped by subject, to review and
                    hand-pick exactly which ones go in. */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span>Select Questions</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 400 }}>
                            Pick
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
                        placeholder="Search the added questions by text or subject..."
                        value={pickerSearch}
                        onChange={e => setPickerSearch(e.target.value)}
                    />
                    <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                        {pickerGroups.length === 0 ? (
                            <p style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                No questions added yet — use "Add random" or "Browse" on a subject above.
                            </p>
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
                    <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
                ) : finalQuestions.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No questions selected — add some above.</p>
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
