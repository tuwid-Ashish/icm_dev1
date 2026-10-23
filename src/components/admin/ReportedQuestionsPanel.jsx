import React, { useState, useEffect, useMemo } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';

// Questions students have flagged as wrong, so the admin works through just
// those — instead of searching a bank of thousands (which would also read every
// question searched). Only OPEN reports are loaded, one read each; closing a
// question's reports takes it off this list.

const REASON_LABELS = {
    wrong_answer: 'Answer marked correct is wrong',
    wrong_question: 'Mistake in the question',
    wrong_option: 'Mistake in an option',
    unclear: 'Unclear or incomplete',
    other: 'Something else'
};

const MAX_REPORTS = 300;

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const ReportedQuestionsPanel = ({ onEditQuestion, onChanged }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [notice, setNotice] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setReports(await firestoreEngine.getOpenQuestionReports({ max: MAX_REPORTS }));
        } catch (err) {
            console.error('[ReportedQuestionsPanel] Could not load reports:', err.message);
            setError('Could not load the reported questions. Please try again.');
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    // One card per question, however many students reported it; the most reported first.
    const groups = useMemo(() => {
        const byQuestion = new Map();
        reports.forEach(r => {
            if (!byQuestion.has(r.questionId)) {
                byQuestion.set(r.questionId, { questionId: r.questionId, subjectCode: r.subjectCode, text: r.questionText, reports: [], reasons: {} });
            }
            const g = byQuestion.get(r.questionId);
            g.reports.push(r);
            g.reasons[r.reason] = (g.reasons[r.reason] || 0) + 1;
        });
        return [...byQuestion.values()]
            .map(g => ({ ...g, reports: g.reports.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) }))
            .sort((a, b) => b.reports.length - a.reports.length || String(b.reports[0].createdAt).localeCompare(String(a.reports[0].createdAt)));
    }, [reports]);

    const closeReports = async (questionId, resolution) => {
        setBusyId(questionId);
        setNotice('');
        try {
            const n = await firestoreEngine.resolveQuestionReports(questionId, resolution);
            setNotice(`Closed ${n} report${n === 1 ? '' : 's'} on ${questionId}.`);
            await load();
            if (onChanged) onChanged();
        } catch (err) {
            setError('Could not close the reports: ' + (err.message || 'unknown error'));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 className="card-title">Reported Questions ({groups.length})</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Questions students have marked as wrong. Edit the question, then close its reports.
                    </p>
                </div>
                <button className="btn btn-secondary" onClick={load} disabled={loading}>
                    {loading ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {notice && (
                <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '1rem' }}>
                    {notice}
                </div>
            )}
            {error && (
                <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

            {loading ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading reported questions...</p>
            ) : groups.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No questions are reported right now.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {groups.map(g => {
                        const notes = g.reports.filter(r => r.note);
                        return (
                            <div key={g.questionId} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem 1.1rem', background: 'var(--bg-surface)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                                    {g.subjectCode && <span className="badge badge-orange">{g.subjectCode}</span>}
                                    <code style={{ fontSize: '0.8rem' }}>{g.questionId}</code>
                                    <span className="badge badge-danger">{g.reports.length} report{g.reports.length === 1 ? '' : 's'}</span>
                                </div>

                                <p style={{ margin: '0 0 0.6rem', fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
                                    {g.text || '(no text)'}{g.text && g.text.length >= 300 ? '…' : ''}
                                </p>

                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                                    {Object.entries(g.reasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                                        <span key={reason} style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                            {REASON_LABELS[reason] || reason}: {count}
                                        </span>
                                    ))}
                                </div>

                                {notes.length > 0 && (
                                    <ul style={{ margin: '0 0 0.75rem 1.1rem', padding: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                                        {notes.slice(0, 5).map(r => (
                                            <li key={r.id}>
                                                &ldquo;{r.note}&rdquo;
                                                <span style={{ color: 'var(--text-muted)' }}> — {r.studentName || 'a student'}, {fmtDate(r.createdAt)}</span>
                                            </li>
                                        ))}
                                        {notes.length > 5 && <li style={{ color: 'var(--text-muted)' }}>…and {notes.length - 5} more notes</li>}
                                    </ul>
                                )}

                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button className="btn btn-primary btn-sm" onClick={() => onEditQuestion && onEditQuestion(g.questionId)} disabled={busyId === g.questionId}>
                                        Edit question
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => closeReports(g.questionId, 'fixed')} disabled={busyId === g.questionId}>
                                        {busyId === g.questionId ? 'Closing...' : 'Fixed — close reports'}
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => closeReports(g.questionId, 'no_issue')} disabled={busyId === g.questionId}>
                                        No issue — close reports
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && reports.length >= MAX_REPORTS && (
                <p style={{ marginTop: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Showing the first {MAX_REPORTS} reports. Close some to see the rest.
                </p>
            )}
        </div>
    );
};
