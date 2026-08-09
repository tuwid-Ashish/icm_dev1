import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useExam } from '../../context/ExamContext.jsx';
import { firestoreEngine } from '../../services/firestoreEngine.js';

export const StudentDashboardPage = ({ onNavigate }) => {
    const { user } = useAuth();
    const { startPracticeTest } = useExam();

    const [exams, setExams] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Setup Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedExam, setSelectedExam] = useState(null);
    const [testMode, setTestMode] = useState('full'); // 'full' | 'subject'
    const [selectedSubject, setSelectedSubject] = useState('ALL');

    useEffect(() => {
        let isMounted = true;
        async function loadData() {
            setLoading(true);
            const loadedExams = await firestoreEngine.getExams();
            const loadedSubmissions = await firestoreEngine.getSubmissions(user?.id || 'std_101');
            if (isMounted) {
                setExams(loadedExams);
                setSubmissions(loadedSubmissions);
                setLoading(false);
            }
        }
        loadData();
        return () => { isMounted = false; };
    }, [user]);

    const totalAttempted = submissions.length;
    const avgScore = totalAttempted > 0 ? (submissions.reduce((s, a) => s + (a.percentage || 0), 0) / totalAttempted).toFixed(1) : '0.0';
    const avgAccuracy = totalAttempted > 0 ? (submissions.reduce((s, a) => s + (a.accuracy || 0), 0) / totalAttempted).toFixed(1) : '0.0';

    const handleOpenModal = (exam) => {
        setSelectedExam(exam);
        setTestMode('full');
        setSelectedSubject('ALL');
        setModalOpen(true);
    };

    const handleLaunchTest = () => {
        if (!selectedExam) return;
        setModalOpen(false);
        const subj = testMode === 'subject' ? selectedSubject : 'ALL';
        const res = startPracticeTest(user?.id || 'std_101', selectedExam.id, subj);
        if (res.error) {
            alert(res.error);
        }
    };

    return (
        <div>
            {/* Page Title Header */}
            <div style={{ marginBottom: '1.75rem' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.1rem', fontWeight: 800 }}>
                    Operational Practice & Assessment Dashboard
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                    Select a recruitment board below to launch a full blueprint test or custom subject practice paper.
                </p>
            </div>

            {/* Top Metrics Row (3 Primary Executive Cards) */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-title">Total Mock Exams Conducted</div>
                    <div className="stat-val">{totalAttempted}</div>
                    <div className="stat-sub">Quota: {user?.remainingTests || 12} Remaining / {user?.allowedTests || 20} Total</div>
                </div>

                <div className="stat-card">
                    <div className="stat-title">Average Qualification Score</div>
                    <div className="stat-val" style={{ color: parseFloat(avgScore) >= 40 ? 'var(--success)' : 'var(--danger)' }}>
                        {avgScore}%
                    </div>
                    <div className="stat-sub">{parseFloat(avgScore) >= 40 ? 'Qualified Performance Level' : 'Needs Preparation'}</div>
                </div>

                <div className="stat-card">
                    <div className="stat-title">Overall Accuracy Rate</div>
                    <div className="stat-val">{avgAccuracy}%</div>
                    <div className="stat-sub">Correct Answers vs Attempted Questions</div>
                </div>
            </div>

            {/* Target Exam Selection Cards (Uniform Height Grid) */}
            <div className="card">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Target Recruitment Examination Boards</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Click any card to launch a full blueprint test or custom subject paper.</p>
                    </div>
                </div>

                {loading ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem 0' }}>Loading recruitment boards...</p>
                ) : (
                    <div className="cards-equal-grid">
                        {exams.map(e => (
                            <div key={e.id} className="exam-select-card" onClick={() => handleOpenModal(e)}>
                                <div>
                                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                                        {e.name}
                                    </h4>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                                        {e.description}
                                    </p>

                                    <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.5rem' }}>
                                        <div>Duration: <strong>{e.durationMinutes} Mins</strong></div>
                                        <div>Questions: <strong>{e.totalQuestions} Qs</strong></div>
                                        <div>Total Marks: <strong>{e.totalMarks} M</strong></div>
                                        <div>Negative Rate: <strong>{e.negativeMarkingRate}</strong></div>
                                    </div>
                                </div>

                                {/* Action Button (Aligned at exact bottom baseline across all cards) */}
                                <button className="btn btn-primary" style={{ width: '100%', fontWeight: 700 }}>
                                    Configure & Launch Test
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Test History */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Completed Practice Test Log</h3>
                </div>

                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Exam Name</th>
                                <th>Date & Time</th>
                                <th>Score</th>
                                <th>Percentage</th>
                                <th>Accuracy</th>
                                <th>Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No practice tests attempted yet. Select an exam board above to begin.
                                    </td>
                                </tr>
                            ) : (
                                submissions.map(sub => (
                                    <tr key={sub.id}>
                                        <td><strong>{sub.examName}</strong></td>
                                        <td><small>{new Date(sub.submittedAt).toLocaleString()}</small></td>
                                        <td><strong>{sub.finalScore} / {sub.totalMarks}</strong></td>
                                        <td>{sub.percentage}%</td>
                                        <td>{sub.accuracy}%</td>
                                        <td>
                                            <span className={`badge ${sub.passed ? 'badge-success' : 'badge-danger'}`}>
                                                {sub.passed ? 'QUALIFIED' : 'FAILED'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Practice Setup Modal */}
            {modalOpen && selectedExam && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <div className="modal-header" style={{ marginBottom: '1.25rem' }}>
                            <h3 className="card-title">Configure Practice Test: {selectedExam.name}</h3>
                            <button className="modal-close" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Select Practice Mode</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <button 
                                    className={`btn ${testMode === 'full' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setTestMode('full')}
                                >
                                    Full Mock Blueprint
                                </button>
                                <button 
                                    className={`btn ${testMode === 'subject' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setTestMode('subject')}
                                >
                                    Random Subject Practice
                                </button>
                            </div>
                        </div>

                        {testMode === 'subject' && (
                            <div className="form-group">
                                <label className="form-label">Select Subject Section</label>
                                <select 
                                    className="form-control"
                                    value={selectedSubject}
                                    onChange={e => setSelectedSubject(e.target.value)}
                                >
                                    <option value="ALL">All Subjects Mixed</option>
                                    {selectedExam.subjects.map(s => (
                                        <option key={s.id} value={s.name}>{s.name} ({s.questionsCount} Qs)</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                            <div>Mode: <strong>{testMode === 'full' ? 'Official Full Mock Exam' : `Subject Practice (${selectedSubject})`}</strong></div>
                            <div>Duration: <strong>{selectedExam.durationMinutes} Minutes</strong></div>
                            <div>Negative Marking Penalty: <strong>{selectedExam.negativeMarkingRate} per wrong answer</strong></div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleLaunchTest}>Start Examination</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
