import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const SystemReportsPage = () => {
    const { t } = useLanguage();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filtering & Sorting States
    const [searchQuery, setSearchQuery] = useState('');
    const [examFilter, setExamFilter] = useState('ALL');
    const [resultFilter, setResultFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('score_desc'); // Default: highest score achiever first

    const loadSubmissions = async () => {
        setLoading(true);
        const loaded = await firestoreEngine.getSubmissions();
        setSubmissions(loaded);
        setLoading(false);
    };

    useEffect(() => {
        loadSubmissions();
    }, []);

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

    // Apply filtering
    let processedSubmissions = submissions.filter(sub => {
        const studentName = getStudentDisplayName(sub).toLowerCase();
        const studentEmail = (sub.studentEmail || '').toLowerCase();
        const query = searchQuery.toLowerCase().trim();

        const matchesQuery = !query || studentName.includes(query) || studentEmail.includes(query);
        const matchesExam = examFilter === 'ALL' || (sub.examName || '').toLowerCase().includes(examFilter.toLowerCase()) || (sub.examCode || '').toLowerCase().includes(examFilter.toLowerCase());
        const matchesResult = resultFilter === 'ALL' || (resultFilter === 'QUALIFIED' && sub.passed) || (resultFilter === 'FAILED' && !sub.passed);

        return matchesQuery && matchesExam && matchesResult;
    });

    // Apply sorting (Default: Highest score achiever to lowest)
    processedSubmissions.sort((a, b) => {
        if (sortBy === 'score_desc') {
            return (b.finalScore || 0) - (a.finalScore || 0);
        } else if (sortBy === 'score_asc') {
            return (a.finalScore || 0) - (b.finalScore || 0);
        } else if (sortBy === 'date_desc') {
            return new Date(b.submittedAt) - new Date(a.submittedAt);
        } else if (sortBy === 'date_asc') {
            return new Date(a.submittedAt) - new Date(b.submittedAt);
        }
        return 0;
    });

    return (
        <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 className="card-title">{t('audit_log_title')} ({processedSubmissions.length} / {submissions.length})</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('audit_log_desc')}</p>
                </div>
                <button className="btn btn-secondary" onClick={loadSubmissions}>
                    ↻ {t('refresh_btn') || 'Refresh Audit Log'}
                </button>
            </div>

            {/* Admin Filter & Sorting Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', padding: '1rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                        Search Student
                    </label>
                    <input 
                        type="text" 
                        className="form-control"
                        placeholder={t('search_student_placeholder')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                        Filter by Exam Board
                    </label>
                    <select 
                        className="form-control"
                        value={examFilter}
                        onChange={e => setExamFilter(e.target.value)}
                    >
                        <option value="ALL">{t('all_exam_boards')}</option>
                        <option value="Police">Police Bharti (पोलीस भरती)</option>
                        <option value="Vanrakshak">Vanrakshak (वनरक्षक भरती)</option>
                        <option value="SSC">SSC GD (एसएससी जीडी)</option>
                    </select>
                </div>

                <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                        Filter by Result
                    </label>
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
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                        Sort Submissions
                    </label>
                    <select 
                        className="form-control"
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                    >
                        <option value="score_desc">🥇 {t('sort_highest_score')}</option>
                        <option value="score_asc">📉 {t('sort_lowest_score')}</option>
                        <option value="date_desc">📅 {t('sort_newest_date')}</option>
                        <option value="date_asc">⏳ {t('sort_oldest_date')}</option>
                    </select>
                </div>
            </div>

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
                                const isTopScoreSort = sortBy === 'score_desc';
                                return (
                                    <tr key={sub.id} style={{ background: isTopScoreSort && rank === 1 ? 'rgba(234, 88, 12, 0.05)' : 'transparent' }}>
                                        <td style={{ textAlign: 'center', fontWeight: 800 }}>
                                            {isTopScoreSort && rank === 1 ? '🥇 #1' : isTopScoreSort && rank === 2 ? '🥈 #2' : isTopScoreSort && rank === 3 ? '🥉 #3' : `#${rank}`}
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
        </div>
    );
};
