import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';

export const StudentTable = ({ onRefresh }) => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [mobile, setMobile] = useState('');
    const [enrollmentId, setEnrollmentId] = useState('');
    const [allowedTests, setAllowedTests] = useState(20);
    const [status, setStatus] = useState('active');

    const loadStudents = async () => {
        setLoading(true);
        const stdList = storageServiceGetStudents();
        setStudents(stdList);
        setLoading(false);
    };

    function storageServiceGetStudents() {
        const localData = localStorage.getItem('sigma_students');
        return localData ? JSON.parse(localData) : [
            { 
                id: 'std_101', 
                name: 'Alex Student', 
                email: 'student@sigma.com', 
                mobile: '9876543210',
                enrollmentId: 'SIGMA-2026-101', 
                allowedTests: 20, 
                completedTests: 8, 
                remainingTests: 12, 
                purchasedPackages: [
                    { packageName: 'Police Batch – 100 Tests', exam: 'Police Bharti', purchaseDate: '10/08/2026', expiry: '12 Months', paymentStatus: 'Paid' }
                ],
                status: 'active' 
            },
            { 
                id: 'std_102', 
                name: 'Rahul Patil', 
                email: 'rahul@sigma.com', 
                mobile: '9876543210',
                enrollmentId: 'SIGMA-2026-102', 
                allowedTests: 100, 
                completedTests: 15, 
                remainingTests: 85, 
                purchasedPackages: [
                    { packageName: 'Police Batch – 100 Tests', exam: 'Police Bharti', purchaseDate: '10/08/2026', expiry: '12 Months', paymentStatus: 'Paid' },
                    { packageName: 'SSC GD – 100 Tests', exam: 'SSC GD', purchaseDate: '10/08/2026', expiry: '12 Months', paymentStatus: 'Paid' }
                ],
                status: 'active' 
            }
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
            setMobile(std.mobile || '');
            setEnrollmentId(std.enrollmentId);
            setAllowedTests(std.allowedTests);
            setStatus(std.status);
        } else {
            setName('');
            setEmail('');
            setMobile('');
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
        
        const currentList = storageServiceGetStudents();
        const existingIdx = currentList.findIndex(s => s.id === stdId);
        const allowedNum = parseInt(allowedTests, 10);
        
        let updated;
        if (existingIdx >= 0) {
            const completed = currentList[existingIdx].completedTests || 0;
            updated = currentList.map(s => s.id === stdId ? {
                ...s,
                name, email, mobile, enrollmentId,
                allowedTests: allowedNum,
                remainingTests: Math.max(0, allowedNum - completed),
                status
            } : s);
        } else {
            updated = [...currentList, {
                id: stdId,
                name, email, mobile, enrollmentId,
                allowedTests: allowedNum,
                completedTests: 0,
                remainingTests: allowedNum,
                purchasedPackages: [
                    { packageName: 'Police Batch – 100 Tests', exam: 'Police Bharti', purchaseDate: new Date().toLocaleDateString('en-IN'), expiry: '12 Months', paymentStatus: 'Paid' }
                ],
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
                    <h3 className="card-title">Student Account & Purchased Packages Management</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>View student registration details, mandatory mobile numbers, and active purchased course packages.</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal(null)}>
                    Create Student Account
                </button>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Student & Mobile</th>
                            <th>Enrollment ID</th>
                            <th>Purchased Course Packages</th>
                            <th>Allowed Quota</th>
                            <th>Remaining Tokens</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(s => (
                            <tr key={s.id}>
                                <td>
                                    <strong>{s.name}</strong><br />
                                    <small style={{ color: 'var(--text-primary)', fontWeight: 700 }}>📱 {s.mobile || '9876543210'}</small><br />
                                    <small style={{ color: 'var(--text-muted)' }}>{s.email}</small>
                                </td>
                                <td><code>{s.enrollmentId}</code></td>
                                <td style={{ maxWidth: '280px' }}>
                                    {s.purchasedPackages && s.purchasedPackages.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            {s.purchasedPackages.map((pkg, idx) => (
                                                <div key={idx} style={{ background: 'var(--bg-subtle)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                                                    <strong>{pkg.packageName}</strong><br />
                                                    <span style={{ color: 'var(--text-muted)' }}>Exam: {pkg.exam} | Date: {pkg.purchaseDate} | Status: <strong style={{ color: 'var(--success)' }}>{pkg.paymentStatus}</strong></span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No packages purchased</span>
                                    )}
                                </td>
                                <td><strong>{s.allowedTests} Tests</strong></td>
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
                                        Edit Details
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

            {/* Quota & Mobile Modal */}
            {modalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <div className="modal-header" style={{ marginBottom: '1.25rem' }}>
                            <h3 className="card-title">{editingStudent ? 'Edit Student Details & Quota' : 'Create Student Account'}</h3>
                            <button className="modal-close" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Full Name *</label>
                                <input type="text" className="form-control" required value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Mobile Number * (Mandatory)</label>
                                <input type="tel" className="form-control" required value={mobile} onChange={e => setMobile(e.target.value)} placeholder="9876543210" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email Address *</label>
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
                                <button type="submit" className="btn btn-primary">Save Student Details</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
