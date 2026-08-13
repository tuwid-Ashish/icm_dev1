import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { MathRenderer } from '../../components/common/MathRenderer.jsx';

export const TestResultPage = ({ result, onBack }) => {
    const { t } = useLanguage();
    const [allSubmissions, setAllSubmissions] = useState([]);
    const [loadingRank, setLoadingRank] = useState(true);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function loadLeaderboard() {
            setLoadingRank(true);
            const subs = await firestoreEngine.getSubmissions();
            if (isMounted) {
                setAllSubmissions(subs);
                setLoadingRank(false);
            }
        }
        loadLeaderboard();
        return () => { isMounted = false; };
    }, [result]);

    if (!result) return null;

    // Filter submissions for this specific exam/test
    const examSubs = allSubmissions.filter(s => s.examId === result.examId || (s.examName && s.examName.includes(result.examName || '')));

    // If current result isn't in Firestore list yet, append it transiently for rank math
    const combinedList = [...examSubs];
    if (!combinedList.some(s => s.id === result.id || (s.studentId === result.studentId && s.submittedAt === result.submittedAt))) {
        combinedList.push(result);
    }

    // Sort by finalScore desc, timeTakenSeconds asc
    combinedList.sort((a, b) => {
        if ((b.finalScore || 0) !== (a.finalScore || 0)) return (b.finalScore || 0) - (a.finalScore || 0);
        return (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
    });

    // Determine current student's rank position
    const userRankIdx = combinedList.findIndex(s => s.id === result.id || (s.studentId === result.studentId && s.submittedAt === result.submittedAt && s.finalScore === result.finalScore));
    const userRank = userRankIdx !== -1 ? userRankIdx + 1 : 1;
    const totalCandidates = combinedList.length;
    const topperScore = combinedList.length > 0 ? (combinedList[0].finalScore || 0) : result.finalScore;

    // Top Rankers List for Modal
    const topRankers = combinedList.slice(0, 10);

    const getRankBadge = (idx) => {
        if (idx === 0) return '🥇 #1';
        if (idx === 1) return '🥈 #2';
        if (idx === 2) return '🥉 #3';
        return `#${idx + 1}`;
    };

    return (
        <div>
            {/* Scorecard Hero Banner */}
            <div className="card" style={{ background: result.passed ? 'var(--success-bg)' : 'var(--danger-bg)', border: `1px solid ${result.passed ? 'var(--success-border)' : 'var(--danger-border)'}`, marginBottom: '1.5rem', padding: '1.75rem 2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div>
                        <span className={`badge ${result.passed ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.85rem', padding: '0.35rem 0.85rem', marginBottom: '0.5rem' }}>
                            {result.passed ? t('scorecard_qualified') : t('scorecard_needs_improvement')}
                        </span>
                        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.75rem, 6vw, 2.8rem)', fontWeight: 800, color: result.passed ? 'var(--success)' : 'var(--danger)', lineHeight: 1.1 }}>
                            {result.finalScore} / {result.totalMarks} {t('marks_unit')}
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.35rem' }}>
                            {t('percentage_th')}: <strong>{result.percentage}%</strong> | {t('accuracy_th')}: <strong>{result.accuracy}%</strong>
                        </p>
                    </div>

                    <button className="btn btn-secondary btn-lg" onClick={onBack}>
                        {t('back_to_dashboard')}
                    </button>
                </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="stat-card">
                    <div className="stat-title">{t('correct_answers_stat')}</div>
                    <div className="stat-val" style={{ color: 'var(--success)' }}>{result.correctCount}</div>
                    <div className="stat-sub">+{result.grossScore} {t('gross_marks_sub')}</div>
                </div>

                <div className="stat-card">
                    <div className="stat-title">{t('wrong_answers_stat')}</div>
                    <div className="stat-val" style={{ color: 'var(--danger)' }}>{result.wrongCount}</div>
                    <div className="stat-sub">-{result.negativeDeduction} {t('negative_penalty_sub')}</div>
                </div>

                <div className="stat-card">
                    <div className="stat-title">{t('unattempted_stat')}</div>
                    <div className="stat-val" style={{ color: 'var(--text-muted)' }}>{result.unattemptedCount}</div>
                    <div className="stat-sub">{t('skipped_questions_sub')}</div>
                </div>

                <div className="stat-card">
                    <div className="stat-title">{t('time_taken_stat')}</div>
                    <div className="stat-val" style={{ fontSize: '1.8rem' }}>
                        {Math.floor(result.timeTakenSeconds / 60)}m {result.timeTakenSeconds % 60}s
                    </div>
                    <div className="stat-sub">{t('completed_session_sub')}</div>
                </div>
            </div>

            {/* Student Rank Display Card (Matching Reference Screenshot) */}
            <div className="card" style={{ 
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)', 
                border: '1.5px solid rgba(168, 85, 247, 0.35)', 
                marginBottom: '1.5rem', 
                textAlign: 'center', 
                padding: '2rem 1.5rem',
                borderRadius: 'var(--radius-lg)'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                    <div style={{ 
                        width: '72px', 
                        height: '72px', 
                        borderRadius: '50%', 
                        background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        boxShadow: '0 8px 24px rgba(168, 85, 247, 0.4)',
                        marginBottom: '0.25rem'
                    }}>
                        <span style={{ fontSize: '2.2rem', color: '#ffffff' }}>★</span>
                    </div>

                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                        {t('your_rank_label')}
                    </div>

                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.5rem, 6vw, 3.8rem)', fontWeight: 900, color: '#a855f7', lineHeight: 1 }}>
                        #{userRank}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        {t('out_of_aspirants')} <strong>{totalCandidates}</strong> {t('aspirants_unit')}
                    </div>

                    <button 
                        className="btn btn-secondary" 
                        style={{ 
                            background: 'rgba(168, 85, 247, 0.15)', 
                            border: '1px solid rgba(168, 85, 247, 0.4)', 
                            color: '#a855f7', 
                            fontWeight: 800, 
                            borderRadius: '24px',
                            padding: '0.55rem 1.75rem',
                            cursor: 'pointer'
                        }}
                        onClick={() => setShowModal(true)}
                    >
                        {t('view_top_rankers')}
                    </button>
                </div>
            </div>

            {/* Comparative Performance Analysis (Reference UI) */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
                    {t('comparative_analysis')}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '2px solid #eab308', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#eab308' }}>#{userRank}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                            {t('your_rank_label')}
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '2px solid #3b82f6', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#3b82f6' }}>{topperScore}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                            {t('topper_score_label')}
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '2px solid #10b981', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#10b981' }}>{result.finalScore}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                            {t('your_score_label')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Question Review Accordion */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">{t('detailed_review_title')}</h3>
                    <button className="btn btn-secondary btn-sm" onClick={onBack}>{t('back_to_dashboard')}</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {result.detailedReview.map(q => (
                        <div key={q.id} style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <strong>{t('question_prefix')} {q.questionNumber}: {q.sectionName}</strong>
                                <span className={`badge ${q.status === 'correct' ? 'badge-success' : q.status === 'wrong' ? 'badge-danger' : 'badge-warning'}`}>
                                    {q.status.toUpperCase()} ({q.isCorrect ? '+' + q.marks : q.status === 'wrong' ? '-' + result.negativeDeduction : '0'})
                                </span>
                            </div>

                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                                <MathRenderer text={q.text} imageUrl={q.imageUrl || (q.questionImages && q.questionImages[0]?.url)} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                                <div>{t('your_answer_label')} <strong style={{ color: q.isCorrect ? 'var(--success)' : q.userAnswerIndex !== null ? 'var(--danger)' : 'var(--text-muted)' }}>{q.userAnswerIndex !== null ? <MathRenderer text={q.options[q.userAnswerIndex]} /> : t('not_attempted_word')}</strong></div>
                                <div>{t('correct_answer_label')} <strong style={{ color: 'var(--success)' }}><MathRenderer text={q.options[q.correctIndex]} /></strong></div>
                            </div>

                            <div style={{ background: 'var(--bg-surface)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-secondary)', borderLeft: '3px solid var(--primary)' }}>
                                <strong>{t('explanation_label')}</strong> <MathRenderer text={q.explanation} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Rankers Leaderboard Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '650px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">🏆 {t('top_rankers_title')}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('rank_th')}</th>
                                        <th>{t('student_name_th')}</th>
                                        <th>{t('score_th')}</th>
                                        <th>{t('accuracy_th')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topRankers.map((item, idx) => (
                                        <tr key={item.id || idx} style={{ background: item.id === result.id ? 'rgba(168, 85, 247, 0.15)' : 'transparent' }}>
                                            <td>
                                                <strong style={{ fontSize: '1.1rem', color: idx === 0 ? '#eab308' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--text-primary)' }}>
                                                    {getRankBadge(idx)}
                                                </strong>
                                            </td>
                                            <td>
                                                <strong>{item.studentName || item.studentEmail?.split('@')[0] || 'Student User'}</strong>
                                                {item.id === result.id && <span className="badge badge-success" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>You</span>}
                                            </td>
                                            <td><strong>{item.finalScore} / {item.totalMarks || result.totalMarks}</strong></td>
                                            <td>{item.accuracy}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
