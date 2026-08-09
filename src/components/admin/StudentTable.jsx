import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';

export const StudentTable = ({ onRefresh }) => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('pass123');
    const [enrollmentId, setEnrollmentId] = useState('');
    const [allowedTests, setAllowedTests] = useState(20);
    const [status, setStatus] = useState('active');

    const loadStudents = async () => {
        setLoading(true);
        // Load student profiles from storage or Firestore engine
        const allStudents = await firestoreEngine.getSubmissions();
        const stdList = storageServiceGetStudents();
        setStudents(stdList);
        setLoading(false);
    };

    function storageServiceGetStudents() {
        const localData = localStorage.getItem('sigma_students');
        return localData ? JSON.parse(localData) : [
            { id: 'std_101', name: 'Alex Student', email: 'student@sigma.com', enrollmentId: 'SIGMA-2026-101', allowedTests: 20, completedTests: 8, remainingTests: 12, status: 'active' },
            { id: 'std_102', name: 'Rahul Student', email: 'rahul@sigma.com', enrollmentId: 'SIGMA-2026-102', allowedTests: 15, completedTests: 15, remainingTests: 0, status: 'active' }
        ];
    }

    useEffect(() => {
        loadStudents();
    }, []);

    const handleOpenModal = (std = null) => {
        setEditingStudent(std);
        if (std) {
            setName(std.name);
            setEmail(std.email);
            setPassword(std.password || 'pass123');
            setEnrollmentId(std.enrollmentId);
            setAllowedTests(std.allowedTests);
            setStatus(std.status);
        } else {
            setName('');
            setEmail('');
            setPassword('pass123');
            setEnrollmentId('SIGMA-2026-' + Math.floor(100 + Math.random() * 900));
            setAllowedTests(20);
            setStatus('active');
        }
        setModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const stdId = editingStudent ? editingStudent.id : 'std_' + Date.now();
        await firestoreEngine.updateStudentQuota(stdId, allowedTests, status);
        
        // Update local state
        const currentList = storageServiceGetStudents();
        const existingIdx = currentList.findIndex(s => s.id === stdId);
        const allowedNum = parseInt(allowedTests, 10);
        
        let updated;
        if (existingIdx >= 0) {
            const completed = currentList[existingIdx].completedTests || 0;
            updated = currentList.map(s => s.id === stdId ? {
                ...s,
                name, email, enrollmentId,
                allowedTests: allowedNum,
                remainingTests: Math.max(0, allowedNum - completed),
                status
            } : s);
        } else {
            updated = [...currentList, {
                id: stdId,
                name, email, enrollmentId,
                allowedTests: allowedNum,
                completedTests: 0,
                remainingTests: allowedNum,
                status
            }];
        }

        localStorage.setItem('sigma_students', JSON.stringify(updated));
        setStudents(updated);
        setModalOpen(false);
        if (onRefresh) onRefresh();
    };

    const handleToggleStatus = (std) => {
        const nextStatus = std.status === 'active' ? 'disabled' : 'active';
        const currentList = storageServiceGetStudents();
        const updated = currentList.map(s => s.id === std.id ? { ...s, status: nextStatus } : s);
        localStorage.setItem('sigma_students', JSON.stringify(updated));
        setStudents(updated);
        if (onRefresh) onRefresh();
    };

    return (
        <div className="card">
            <div className="card-header">
                <div>
                    <h3 className="card-title">Student Accounts & Practice Quota Limits</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Configure allowed mock test limits per student account and manage platform access.</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal(null)}>
                    Create Student Account
                </button>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Student Name & Email</th>
                            <th>Enrollment ID</th>
                            <th>Allowed Quota</th>
                            <th>Completed</th>
                            <th>Remaining Balance</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(s => (
                            <tr key={s.id}>
                                <td>
                                    <strong>{s.name}</strong><br />
                                    <small style={{ color: 'var(--text-muted)' }}>{s.email}</small>
                                </td>
                                <td><code>{s.enrollmentId}</code></td>
                                <td><strong>{s.allowedTests} Tests</strong></td>
                                <td>{s.completedTests}</td>
                                <td>
                                    <span className={`badge ${s.remainingTests > 0 ? 'badge-success' : 'badge-danger'}`}>
                                        {s.remainingTests} Tokens Left
                                    </span>
                                </td>
                                <td>
                                    <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                                        {s.status.toUpperCase()}
                                    </span>
                                </td>
                                <td>
                                    <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(s)}>
                                        Adjust Limit
                                    </button>
                                    <button 
                                        className={`btn ${s.status === 'active' ? 'btn-danger' : 'btn-primary'} btn-sm`}
                                        style={{ marginLeft: '0.35rem' }}
                                        onClick={() => handleToggleStatus(s)}
                                    >
                                        {s.status === 'active' ? 'Disable' : 'Enable'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Quota Modal */}
            {modalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <div className="modal-header" style={{ marginBottom: '1.25rem' }}>
                            <h3 className="card-title">{editingStudent ? 'Adjust Student Practice Limit' : 'Create Student Account'}</h3>
                            <button className="modal-close" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input type="text" className="form-control" required value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input type="email" className="form-control" required value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Enrollment ID</label>
                                <input type="text" className="form-control" value={enrollmentId} onChange={e => setEnrollmentId(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Practice Test Quota (Allowed Mock Tests)</label>
                                <input type="number" className="form-control" required min="1" max="500" value={allowedTests} onChange={e => setAllowedTests(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
                                    <option value="active">Active</option>
                                    <option value="disabled">Disabled</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingStudent ? 'Save Quota Limit' : 'Create Account'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
