import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { storageService } from '../../services/storageService.js';

export const AnalyticsPage = () => {
    const { user } = useAuth();
    const submissions = storageService.getStudentSubmissions(user.id);

    return (
        <div className="card">
            <div className="card-header">
                <div>
                    <h3 className="card-title">📊 Subject Strength & Accuracy Analytics</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Visual performance metrics across attempted competitive exams.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ background: 'var(--bg-subtle)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem', fontWeight: 800 }}>Attempt Accuracy Breakdown</h4>
                    {submissions.length === 0 ? (
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Attempt mock tests to generate accuracy analytics.</p>
                    ) : (
                        submissions.map(s => (
                            <div key={s.id} style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                    <span>{s.examCode} ({new Date(s.submittedAt).toLocaleDateString()})</span>
                                    <strong>{s.accuracy}% Accuracy</strong>
                                </div>
                                <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                    <div style={{ width: `${s.accuracy}%`, height: '100%', background: 'var(--primary)' }}></div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem', fontWeight: 800 }}>Exam Strategy Recommendations</h4>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                        <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--success)' }}>✅</span> Mathematics & Reasoning scores show consistent high accuracy.
                        </li>
                        <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--warning)' }}>⚠️</span> Watch negative marks in Forest Guard (0.5 mark deduction per wrong answer).
                        </li>
                        <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--primary)' }}>💡</span> Complete 2 more Full-Length mocks to optimize speed under timer pressure.
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
