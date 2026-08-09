import React from 'react';

export const ScorecardResult = ({ result, onBack }) => {
    if (!result) return null;

    return (
        <div>
            <div class="score-card-banner">
                <span class={`badge ${result.passed ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '1rem', padding: '0.5rem 1rem', marginBottom: '0.5rem' }}>
                    {result.passed ? '🎉 PASSED / QUALIFIED' : '⚠️ NEEDS IMPROVEMENT'}
                </span>
                <div class="score-big">{result.finalScore} / {result.totalMarks}</div>
                <p style={{ fontSize: '1.2rem', opacity: 0.9 }}>Overall Score: {result.percentage}% | Accuracy: {result.accuracy}%</p>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-header"><span>Correct Answers</span></div>
                    <div class="stat-value" style={{ color: 'var(--success)' }}>{result.correctCount}</div>
                    <div class="stat-footer">+{result.grossScore} Gross Marks</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span>Wrong Answers</span></div>
                    <div class="stat-value" style={{ color: 'var(--danger)' }}>{result.wrongCount}</div>
                    <div class="stat-footer">-{result.negativeDeduction} Negative Deductions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span>Unattempted</span></div>
                    <div class="stat-value" style={{ color: 'var(--text-muted)' }}>{result.unattemptedCount}</div>
                    <div class="stat-footer">Skipped Questions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span>Time Taken</span></div>
                    <div class="stat-value" style={{ fontSize: '1.8rem' }}>
                        {Math.floor(result.timeTakenSeconds / 60)}m {result.timeTakenSeconds % 60}s
                    </div>
                    <div class="stat-footer">Completed Session</div>
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">🔍 Detailed Question-by-Question Review</h3>
                    <button class="btn btn-secondary btn-sm" onClick={onBack}>Back to Dashboard</button>
                </div>

                <div class="review-accordion">
                    {result.detailedReview.map(q => (
                        <div key={q.id} class={`review-item ${q.status}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <strong>Question {q.questionNumber}: {q.sectionName}</strong>
                                <span class={`badge ${q.status === 'correct' ? 'badge-success' : q.status === 'wrong' ? 'badge-danger' : 'badge-warning'}`}>
                                    {q.status.toUpperCase()} ({q.isCorrect ? '+' + q.marks : q.status === 'wrong' ? '-' + (q.marks * result.negativeDeduction) : '0'})
                                </span>
                            </div>
                            <div style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>{q.text}</div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                <div>Your Answer: <strong style={{ color: q.isCorrect ? 'var(--success)' : q.userAnswerIndex !== null ? 'var(--danger)' : 'var(--text-muted)' }}>{q.userAnswerIndex !== null ? q.options[q.userAnswerIndex] : 'Not Attempted'}</strong></div>
                                <div>Correct Answer: <strong style={{ color: 'var(--success)' }}>{q.options[q.correctIndex]}</strong></div>
                            </div>
                            
                            <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-secondary)', borderLeft: '3px solid var(--brand-primary)' }}>
                                💡 <strong>Explanation:</strong> {q.explanation}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
