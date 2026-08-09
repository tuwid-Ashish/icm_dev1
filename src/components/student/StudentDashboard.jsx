import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useExam } from '../../context/ExamContext.jsx';
import { storageService } from '../../services/storageService.js';

export const StudentDashboard = ({ onStartTest, onViewResult }) => {
    const { user } = useAuth();
    const { startPracticeTest } = useExam();
    const exams = storageService.getExams();
    const submissions = storageService.getStudentSubmissions(user.id);

    const totalAttempted = submissions.length;
    const avgScore = totalAttempted > 0 ? (submissions.reduce((s, a) => s + a.percentage, 0) / totalAttempted).toFixed(1) : '0.0';
    const avgAccuracy = totalAttempted > 0 ? (submissions.reduce((s, a) => s + a.accuracy, 0) / totalAttempted).toFixed(1) : '0.0';

    return (
        <div>
            {/* Banner Card */}
            <div class="panel" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)', border: '1px solid var(--border-highlight)', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <span class={`badge ${user.remainingTests > 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                            🎯 REMAINING TEST BALANCE: {user.remainingTests} / {user.allowedTests}
                        </span>
                        <h2 style={{ fontFamily: 'var(--font-heading)', marginTop: '0.5rem', fontSize: '1.6rem' }}>
                            {user.remainingTests > 0 ? 'Ready for your next mock test?' : 'Test Limit Exhausted!'}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                            {user.remainingTests > 0 
                                ? 'Generate a new paper from our randomized question database.' 
                                : 'You have 0 remaining tests. Contact Administrator to increase your limit.'}
                        </p>
                    </div>
                    <button 
                        class="btn btn-gradient btn-lg" 
                        disabled={user.remainingTests <= 0}
                        onClick={() => onStartTest(exams[0]?.id)}
                    >
                        ⚡ Generate Practice Test
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-header">
                        <span>Tests Completed</span>
                        <div class="stat-icon">📝</div>
                    </div>
                    <div class="stat-value">{totalAttempted}</div>
                    <div class="stat-footer">Of {user.allowedTests} Max Quota</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header">
                        <span>Remaining Balance</span>
                        <div class="stat-icon">🎟️</div>
                    </div>
                    <div class="stat-value" style={{ color: user.remainingTests > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {user.remainingTests}
                    </div>
                    <div class="stat-footer">Available Attempts</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header">
                        <span>Average Percentage</span>
                        <div class="stat-icon">📊</div>
                    </div>
                    <div class="stat-value">{avgScore}%</div>
                    <div class="stat-footer">Across Evaluated Tests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header">
                        <span>Overall Accuracy</span>
                        <div class="stat-icon">🎯</div>
                    </div>
                    <div class="stat-value">{avgAccuracy}%</div>
                    <div class="stat-footer">Correct vs Attempted</div>
                </div>
            </div>

            {/* Content Grid: Available Exams & Recent Activity */}
            <div class="content-grid">
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">🎯 Supported Exam Blueprints</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {exams.map(e => (
                            <div key={e.id} style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                    <span class="badge badge-purple">{e.code}</span>
                                    <strong style={{ marginLeft: '0.5rem', fontSize: '1.05rem' }}>{e.name}</strong>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                        ⏱️ {e.durationMinutes} Mins | 🎯 {e.totalQuestions} Questions | 💯 {e.totalMarks} Marks | ⚠️ Negative: {e.negativeMarkingRate}
                                    </div>
                                </div>
                                <button 
                                    class="btn btn-secondary btn-sm" 
                                    disabled={user.remainingTests <= 0}
                                    onClick={() => onStartTest(e.id)}
                                >
                                    Start Test
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">📜 Recent Test Results</h3>
                    </div>
                    {submissions.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
                            No tests attempted yet. Click "Generate Practice Test" to begin!
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {submissions.slice(0, 4).map(sub => (
                                <div key={sub.id} style={{ background: 'var(--bg-primary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong style={{ fontSize: '0.9rem' }}>{sub.examCode || sub.examName}</strong>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(sub.submittedAt).toLocaleDateString()}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <button 
                                            class={`badge ${sub.passed ? 'badge-success' : 'badge-danger'}`}
                                            style={{ cursor: 'pointer', border: 'none' }}
                                            onClick={() => onViewResult(sub)}
                                        >
                                            {sub.percentage}% Scorecard
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
