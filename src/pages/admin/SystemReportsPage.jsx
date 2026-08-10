import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';

export const SystemReportsPage = () => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 className="card-title">System-Wide Test Submission Audit Log ({submissions.length} Total Attempts)</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Complete audit record of all evaluated practice tests submitted by students.</p>
                </div>
                <button className="btn btn-secondary" onClick={loadSubmissions}>
                    ↻ Refresh Audit Log
                </button>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Student Name</th>
                            <th>Target Exam</th>
                            <th>Date & Time</th>
                            <th>Time Spent</th>
                            <th>Net Score</th>
                            <th>Percentage</th>
                            <th>Accuracy</th>
                            <th>Result Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading system submission records...</td></tr>
                        ) : submissions.length === 0 ? (
                            <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No student submissions logged yet.</td></tr>
                        ) : (
                            submissions.map(sub => (
                                <tr key={sub.id}>
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
                                    <td><strong>{sub.finalScore} / {sub.totalMarks}</strong></td>
                                    <td><strong>{sub.percentage}%</strong></td>
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
    );
};
