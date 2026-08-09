import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { firestoreEngine } from '../../services/firestoreEngine.js';

export const HistoryPage = ({ onViewResult }) => {
    const { user } = useAuth();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchFilter, setSearchFilter] = useState('');

    useEffect(() => {
        let isMounted = true;
        async function loadSubmissions() {
            setLoading(true);
            const loaded = await firestoreEngine.getSubmissions(user?.id || 'std_101');
            if (isMounted) {
                setSubmissions(loaded);
                setLoading(false);
            }
        }
        loadSubmissions();
        return () => { isMounted = false; };
    }, [user]);

    // Subject accuracy calculation from detailed reviews
    const subjectStats = {
        'Mathematics': { correct: 0, total: 0 },
        'Reasoning': { correct: 0, total: 0 },
        'General Knowledge': { correct: 0, total: 0 },
        'Language (Marathi/English)': { correct: 0, total: 0 }
    };

    submissions.forEach(sub => {
        if (sub.detailedReview) {
            sub.detailedReview.forEach(q => {
                const sec = q.sectionName || '';
                let key = 'General Knowledge';
                if (sec.includes('Math') || sec.includes('अंकगणित')) key = 'Mathematics';
                else if (sec.includes('Reasoning') || sec.includes('Intelligence') || sec.includes('बुद्धिमत्ता')) key = 'Reasoning';
                else if (sec.includes('Marathi') || sec.includes('English') || sec.includes('मराठी')) key = 'Language (Marathi/English)';

                if (subjectStats[key]) {
                    subjectStats[key].total++;
                    if (q.isCorrect) subjectStats[key].correct++;
                }
            });
        }
    });

    const filteredSubmissions = submissions.filter(sub => 
        sub.examName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        sub.examCode.toLowerCase().includes(searchFilter.toLowerCase())
    );

    return (
        <div>
            {/* Page Header */}
            <div style={{ marginBottom: '1.75rem' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.1rem', fontWeight: 800 }}>
                    Historical Audit & Performance Analytics
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                    In-depth historical test attempt logs, score trend analytics, and subject weakness detection.
                </p>
            </div>

            {/* Analytics Section: Subject Accuracy Breakdown Bars */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Subject Accuracy & Weakness Detector</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Aggregated accuracy rates across all completed practice tests.</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                    {Object.keys(subjectStats).map(subj => {
                        const stat = subjectStats[subj];
                        const acc = stat.total > 0 ? parseFloat(((stat.correct / stat.total) * 100).toFixed(1)) : 0;
                        return (
                            <div key={subj} style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                    {subj}
                                </div>
                                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 800, color: acc >= 50 ? 'var(--success)' : stat.total === 0 ? 'var(--text-muted)' : 'var(--danger)', marginBottom: '0.5rem' }}>
                                    {acc}%
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    {stat.correct} Correct of {stat.total} Attempted
                                </div>

                                <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                    <div style={{ width: `${acc}%`, height: '100%', background: acc >= 50 ? 'var(--success)' : 'var(--danger)' }}></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Historical Attempt Log Table */}
            <div className="card">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h3 className="card-title">Attempt Log & Scorecards</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Search and review detailed question-by-question scorecards.</p>
                    </div>

                    <input 
                        type="text"
                        className="form-control"
                        style={{ maxWidth: '280px' }}
                        placeholder="Search exam name or code..."
                        value={searchFilter}
                        onChange={e => setSearchFilter(e.target.value)}
                    />
                </div>
                
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Exam Name</th>
                                <th>Date & Time</th>
                                <th>Time Taken</th>
                                <th>Net Score</th>
                                <th>Percentage</th>
                                <th>Accuracy</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading completed test history...</td></tr>
                            ) : filteredSubmissions.length === 0 ? (
                                <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No test attempt logs match your search.</td></tr>
                            ) : (
                                filteredSubmissions.map(sub => (
                                    <tr key={sub.id}>
                                        <td><strong>{sub.examName}</strong></td>
                                        <td><small>{new Date(sub.submittedAt).toLocaleString()}</small></td>
                                        <td>{Math.floor((sub.timeTakenSeconds || 0) / 60)}m {(sub.timeTakenSeconds || 0) % 60}s</td>
                                        <td><strong>{sub.finalScore} / {sub.totalMarks}</strong></td>
                                        <td>{sub.percentage}%</td>
                                        <td>{sub.accuracy}%</td>
                                        <td>
                                            <span className={`badge ${sub.passed ? 'badge-success' : 'badge-danger'}`}>
                                                {sub.passed ? 'QUALIFIED' : 'FAILED'}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn btn-secondary btn-sm" onClick={() => onViewResult(sub)}>
                                                View Scorecard
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
