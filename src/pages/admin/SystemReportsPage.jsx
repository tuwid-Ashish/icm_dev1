import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

const PAGE_SIZE = 50;

// Firestore reports a missing composite index as 'failed-precondition'.
const describeError = (err) => (err && err.code === 'failed-precondition'
    ? 'This view needs a one-time database index that is not ready yet. It takes a few minutes to build. Try again shortly, or choose a different exam or sort.'
    : 'Could not load the reports. Please try again.');

/**
 * Every test attempt, newest or best first, 50 at a time. This screen used to
 * load every attempt ever taken — one database read each, on every visit — and
 * sort and filter them in the browser, so it got slower and dearer with every
 * test a student sat. Sorting, the exam filter and search now happen in
 * Firestore, and only the page on screen is read.
 */
export const SystemReportsPage = () => {
    const { t } = useLanguage();
    const [submissions, setSubmissions] = useState([]);
    const [pageCursor, setPageCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [totalAttempts, setTotalAttempts] = useState(0);
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [searchInput, setSearchInput] = useState('');
    const [activeSearch, setActiveSearch] = useState('');    // '' = browsing, not searching
    const [examFilter, setExamFilter] = useState('ALL');     // an exam id (filtered by Firestore)
    const [resultFilter, setResultFilter] = useState('ALL'); // applies to the rows loaded
    const [sortBy, setSortBy] = useState('score_desc');      // Default: highest score achiever first

    const loadFirstPage = async () => {
        setLoading(true);
        setError('');
        try {
            if (activeSearch) {
                setSubmissions(await firestoreEngine.searchSubmissions(activeSearch));
                setPageCursor(null);
                setHasMore(false);
            } else {
                const page = await firestoreEngine.getSubmissionsPage({
                    sort: sortBy,
                    examId: examFilter === 'ALL' ? null : examFilter,
                    pageSize: PAGE_SIZE
                });
                setSubmissions(page.submissions);
                setPageCursor(page.cursor);
                setHasMore(page.hasMore);
            }
        } catch (err) {
            console.error('[SystemReportsPage] Could not load attempts:', err.code || '', err.message);
            setError(describeError(err));
            setSubmissions([]);
            setHasMore(false);
        }
        setLoading(false);
    };

    const loadMore = async () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        try {
            const page = await firestoreEngine.getSubmissionsPage({
                sort: sortBy,
                examId: examFilter === 'ALL' ? null : examFilter,
                pageSize: PAGE_SIZE,
                cursor: pageCursor
            });
            setSubmissions(prev => [...prev, ...page.submissions]);
            setPageCursor(page.cursor);
            setHasMore(page.hasMore);
        } catch (err) {
            console.error('[SystemReportsPage] Could not load more attempts:', err.message);
            setError(describeError(err));
        }
        setLoadingMore(false);
    };

    // Reload the first page whenever what is being asked for changes.
    useEffect(() => {
        loadFirstPage();
    }, [sortBy, examFilter, activeSearch]);

    useEffect(() => {
        (async () => {
            const [examList, count] = await Promise.all([firestoreEngine.getExams(), firestoreEngine.countAttempts()]);
            setExams(examList);
            setTotalAttempts(count);
        })();
    }, []);

    const handleRefresh = async () => {
        setTotalAttempts(await firestoreEngine.countAttempts());
        await loadFirstPage();
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setActiveSearch(searchInput.trim());
    };

    const clearSearch = () => {
        setSearchInput('');
        setActiveSearch('');
    };

    const handleExamChange = (value) => {
        setExamFilter(value);
        // With an exam chosen, only the date sorts are available (the exam + date
        // index); fall back to newest-first if a score sort was selected.
        if (value !== 'ALL' && sortBy.startsWith('score')) setSortBy('date_desc');
    };

    // Helper to get actual student name instead of raw Firestore/Auth UID
    const getStudentDisplayName = (sub) => {
        if (sub.studentName && sub.studentName !== sub.studentId && !sub.studentName.match(/^[a-zA-Z0-9]{20,}$/)) {
            return sub.studentName;
        }
        if (sub.studentEmail) {
            const namePart = sub.studentEmail.split('@')[0];
            return namePart.charAt(0).toUpperCase() + namePart.slice(1).replace(/[._-]/g, ' ');
        }
        const knownStudents = {
            'std_101': 'Alex Student',
            'std_102': 'Rahul Student',
            'Eif5OPuos2f04FHs3tGGTlkn8b23': 'Test Singh'
        };
        if (knownStudents[sub.studentId]) {
            return knownStudents[sub.studentId];
        }
        return 'Test Student';
    };

    // The result filter works on the rows already loaded.
    const processedSubmissions = submissions.filter(sub =>
        resultFilter === 'ALL' || (resultFilter === 'QUALIFIED' && sub.passed) || (resultFilter === 'FAILED' && !sub.passed)
    );

    // A rank is only real when the list is the whole bank sorted by score, from
    // the top: the first page of a score-sorted, unfiltered list is ranks 1..50
    // and each further page continues the count. Under any other view the row
    // position is not a rank.
    const rankMeaningful = sortBy === 'score_desc' && examFilter === 'ALL' && !activeSearch && resultFilter === 'ALL';

    const controlLabel = { fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' };

    return (
        <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 className="card-title">{t('audit_log_title')} ({processedSubmissions.length} shown of {totalAttempts})</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('audit_log_desc')}</p>
                </div>
                <button className="btn btn-secondary" onClick={handleRefresh}>
                    ↻ {t('refresh_btn') || 'Refresh Audit Log'}
                </button>
            </div>

            {/* Admin Filter & Sorting Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', padding: '1rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                <form onSubmit={handleSearch}>
                    <label style={controlLabel}>Search Student</label>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Email, or the start of the name"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary btn-sm">Go</button>
                        {activeSearch && <button type="button" className="btn btn-secondary btn-sm" onClick={clearSearch}>Clear</button>}
                    </div>
                </form>

                <div>
                    <label style={controlLabel}>Filter by Exam</label>
                    <select
                        className="form-control"
                        value={examFilter}
                        onChange={e => handleExamChange(e.target.value)}
                        disabled={!!activeSearch}
                    >
                        <option value="ALL">{t('all_exam_boards')}</option>
                        {exams.map(e => (
                            <option key={e.id} value={e.id}>{e.name || e.title || e.id}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={controlLabel}>Filter by Result (rows shown)</label>
                    <select
                        className="form-control"
                        value={resultFilter}
                        onChange={e => setResultFilter(e.target.value)}
                    >
                        <option value="ALL">{t('all_results')}</option>
                        <option value="QUALIFIED">{t('only_qualified')}</option>
                        <option value="FAILED">{t('only_failed')}</option>
                    </select>
                </div>

                <div>
                    <label style={controlLabel}>Sort Submissions</label>
                    <select
                        className="form-control"
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        disabled={!!activeSearch}
                    >
                        <option value="score_desc" disabled={examFilter !== 'ALL'}>🥇 {t('sort_highest_score')}</option>
                        <option value="score_asc" disabled={examFilter !== 'ALL'}>📉 {t('sort_lowest_score')}</option>
                        <option value="date_desc">📅 {t('sort_newest_date')}</option>
                        <option value="date_asc">⏳ {t('sort_oldest_date')}</option>
                    </select>
                </div>
            </div>

            {activeSearch && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Showing attempts matching &quot;{activeSearch}&quot;, newest first. Clear the search to browse everything again.
                </p>
            )}
            {examFilter !== 'ALL' && !activeSearch && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    With one exam chosen the list can be sorted by date only.
                </p>
            )}
            {error && (
                <p style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 700, marginBottom: '0.75rem' }}>{error}</p>
            )}

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: '70px', textAlign: 'center' }}>{t('rank_th')}</th>
                            <th>{t('student_name_th')}</th>
                            <th>{t('target_exam_th')}</th>
                            <th>{t('date_time_th')}</th>
                            <th>{t('time_taken_th')}</th>
                            <th>{t('net_score_th')}</th>
                            <th>{t('percentage_th')}</th>
                            <th>{t('accuracy_th')}</th>
                            <th>{t('result_th')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading system submission records...</td></tr>
                        ) : processedSubmissions.length === 0 ? (
                            <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No student submissions match your filters.</td></tr>
                        ) : (
                            processedSubmissions.map((sub, index) => {
                                const rank = index + 1;
                                return (
                                    <tr key={sub.id} style={{ background: rankMeaningful && rank === 1 ? 'rgba(234, 88, 12, 0.05)' : 'transparent' }}>
                                        <td style={{ textAlign: 'center', fontWeight: 800 }}>
                                            {/* A rank only means something for an unfiltered list sorted by
                                                score from the top. Under any other view, `index + 1` is just a
                                                row number — sorting by date made the newest submission "#1". */}
                                            {!rankMeaningful ? '—' : rank === 1 ? '🥇 #1' : rank === 2 ? '🥈 #2' : rank === 3 ? '🥉 #3' : `#${rank}`}
                                        </td>
                                        <td>
                                            <strong>{getStudentDisplayName(sub)}</strong><br />
                                            {sub.studentEmail && <small style={{ color: 'var(--text-muted)' }}>{sub.studentEmail}</small>}
                                        </td>
                                        <td>
                                            <strong>{sub.examName}</strong><br />
                                            <small style={{ color: 'var(--text-muted)' }}>({sub.examCode})</small>
                                        </td>
                                        <td><small>{new Date(sub.submittedAt).toLocaleString()}</small></td>
                                        <td>{Math.floor((sub.timeTakenSeconds || 0) / 60)}m {(sub.timeTakenSeconds || 0) % 60}s</td>
                                        <td><strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>{sub.finalScore} / {sub.totalMarks}</strong></td>
                                        <td><strong>{sub.percentage}%</strong></td>
                                        <td>{sub.accuracy}%</td>
                                        <td>
                                            <span className={`badge ${sub.passed ? 'badge-success' : 'badge-danger'}`}>
                                                {sub.passed ? t('qualified_badge') : t('failed_badge')}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {!activeSearch && (
                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span>Showing {submissions.length} attempts{examFilter === 'ALL' ? ` of ${totalAttempts}` : ' for this exam'}.</span>
                    {hasMore && (
                        <button className="btn btn-secondary" onClick={loadMore} disabled={loadingMore}>
                            {loadingMore ? 'Loading...' : `Load ${PAGE_SIZE} more`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
