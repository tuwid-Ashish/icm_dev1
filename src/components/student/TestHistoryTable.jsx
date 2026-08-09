import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { storageService } from '../../services/storageService.js';

export const TestHistoryTable = ({ onViewResult }) => {
    const { user } = useAuth();
    const submissions = storageService.getStudentSubmissions(user.id);

    return (
        <div class="panel">
            <div class="panel-header">
                <h3 class="panel-title">📜 Completed Practice Test Records</h3>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Exam</th>
                            <th>Date & Time</th>
                            <th>Score</th>
                            <th>Percentage</th>
                            <th>Accuracy</th>
                            <th>Result</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {submissions.length === 0 ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center' }}>No past test records found.</td></tr>
                        ) : (
                            submissions.map(sub => (
                                <tr key={sub.id}>
                                    <td><strong>{sub.examName}</strong></td>
                                    <td><small>{new Date(sub.submittedAt).toLocaleString()}</small></td>
                                    <td><strong>{sub.finalScore} / {sub.totalMarks}</strong></td>
                                    <td>{sub.percentage}%</td>
                                    <td>{sub.accuracy}%</td>
                                    <td><span class={`badge ${sub.passed ? 'badge-success' : 'badge-danger'}`}>{sub.passed ? 'PASS' : 'FAIL'}</span></td>
                                    <td>
                                        <button class="btn btn-secondary btn-sm" onClick={() => onViewResult(sub)}>
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
    );
};
