import React from 'react';

export const TestResultPage = ({ result, onBack }) => {
    if (!result) return null;

    return (
        <div>
            {/* Scorecard Hero Banner */}
            <div className="card" style={{ background: result.passed ? 'var(--success-bg)' : 'var(--danger-bg)', border: `1px solid ${result.passed ? 'var(--success-border)' : 'var(--danger-border)'}`, marginBottom: '1.75rem', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div>
                        <span className={`badge ${result.passed ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.85rem', padding: '0.35rem 0.85rem', marginBottom: '0.5rem' }}>
                            {result.passed ? 'QUALIFIED / PASSED' : 'NEEDS IMPROVEMENT'}
                        </span>
                        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.8rem', fontWeight: 800, color: result.passed ? 'var(--success)' : 'var(--danger)', lineHeight: 1.1 }}>
                            {result.finalScore} / {result.totalMarks} Marks
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.35rem' }}>
                            Percentage Score: <strong>{result.percentage}%</strong> | Accuracy: <strong>{result.accuracy}%</strong>
                        </p>
                    </div>

                    <button className="btn btn-secondary btn-lg" onClick={onBack}>
                        Back to Dashboard
                    </button>
                </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-title">Correct Answers</div>
                    <div className="stat-val" style={{ color: 'var(--success)' }}>{result.correctCount}</div>
                    <div className="stat-sub">+{result.grossScore} Gross Marks</div>
                </div>

                <div className="stat-card">
                    <div className="stat-title">Wrong Answers</div>
                    <div className="stat-val" style={{ color: 'var(--danger)' }}>{result.wrongCount}</div>
                    <div className="stat-sub">-{result.negativeDeduction} Negative Penalty</div>
                </div>

                <div className="stat-card">
                    <div className="stat-title">Unattempted</div>
                    <div className="stat-val" style={{ color: 'var(--text-muted)' }}>{result.unattemptedCount}</div>
                    <div className="stat-sub">Skipped Questions</div>
                </div>

                <div className="stat-card">
                    <div className="stat-title">Time Taken</div>
                    <div className="stat-val" style={{ fontSize: '1.8rem' }}>
                        {Math.floor(result.timeTakenSeconds / 60)}m {result.timeTakenSeconds % 60}s
                    </div>
                    <div className="stat-sub">Completed Session</div>
                </div>
            </div>

            {/* Question Review Accordion */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Question-by-Question Detailed Review</h3>
                    <button className="btn btn-secondary btn-sm" onClick={onBack}>Back to Dashboard</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {result.detailedReview.map(q => (
                        <div key={q.id} style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <strong>Question {q.questionNumber}: {q.sectionName}</strong>
                                <span className={`badge ${q.status === 'correct' ? 'badge-success' : q.status === 'wrong' ? 'badge-danger' : 'badge-warning'}`}>
                                    {q.status.toUpperCase()} ({q.isCorrect ? '+' + q.marks : q.status === 'wrong' ? '-' + result.negativeDeduction : '0'})
                                </span>
                            </div>

                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                                {q.text}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                                <div>Your Answer: <strong style={{ color: q.isCorrect ? 'var(--success)' : q.userAnswerIndex !== null ? 'var(--danger)' : 'var(--text-muted)' }}>{q.userAnswerIndex !== null ? q.options[q.userAnswerIndex] : 'Not Attempted'}</strong></div>
                                <div>Correct Answer: <strong style={{ color: 'var(--success)' }}>{q.options[q.correctIndex]}</strong></div>
                            </div>

                            <div style={{ background: 'var(--bg-surface)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-secondary)', borderLeft: '3px solid var(--primary)' }}>
                                <strong>Explanation:</strong> {q.explanation}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
