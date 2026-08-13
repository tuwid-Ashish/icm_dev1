import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { Modal } from '../common/Modal.jsx';

export const StudentTable = ({ onRefresh }) => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [mobile, setMobile] = useState('');
    const [enrollmentId, setEnrollmentId] = useState('');
    const [allowedTests, setAllowedTests] = useState(0);
    const [status, setStatus] = useState('active');

    const loadStudents = async () => {
        setLoading(true);
        const stdList = await firestoreEngine.getStudents();
        setStudents(stdList);
        setLoading(false);
    };

    useEffect(() => {
        loadStudents();
    }, []);

    const handleOpenModal = (std = null) => {
        setEditingStudent(std);
        if (std) {
            setName(std.name || '');
            setEmail(std.email || '');
            setMobile(std.mobile || '');
            setEnrollmentId(std.enrollmentId || ('SIGMA-2026-' + Math.floor(100 + Math.random() * 900)));
            setAllowedTests(std.allowedTests || 0);
            setStatus(std.status || 'active');
        } else {
            setName('');
            setEmail('');
            setMobile('');
            setEnrollmentId('SIGMA-2026-' + Math.floor(100 + Math.random() * 900));
            setAllowedTests(0);
            setStatus('active');
        }
        setModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const cleanMobile = mobile.trim();
        if (!cleanMobile || !/^[0-9]{10}$/.test(cleanMobile)) {
            alert('Student Mobile Number is mandatory and must be exactly 10 digits (e.g. 9876543210).');
            return;
        }

        const stdId = editingStudent ? (editingStudent.id || editingStudent.uid) : 'std_' + Date.now();
        await firestoreEngine.saveStudentProfile({
            id: stdId,
            uid: stdId,
            name: name.trim(),
            email: email.trim(),
            mobile: cleanMobile,
            enrollmentId,
            allowedTests,
            status
        });
        await loadStudents();
        setModalOpen(false);
        if (onRefresh) onRefresh();
    };

    const handleToggleStatus = async (std) => {
        const nextStatus = std.status === 'active' ? 'disabled' : 'active';
        const stdId = std.id || std.uid;
        await firestoreEngine.updateStudentQuota(stdId, std.allowedTests || 0, nextStatus);
        await loadStudents();
        if (onRefresh) onRefresh();
    };

    return (
        <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 className="card-title">Registered Students & Purchased Packages ({students.length} Accounts)</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Manage all registered student accounts, mandatory mobile numbers, and active purchased course packages.</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal(null)}>
                    + Create Student Account
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
                            <th>Remaining Tests</th>
                            <th>Status</th>
                            <th style={{ minWidth: '220px', whiteSpace: 'nowrap' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading student accounts from Cloud Firestore...</td></tr>
                        ) : students.length === 0 ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No student accounts registered yet.</td></tr>
                        ) : (
                            students.map(s => (
                                <tr key={s.id || s.uid}>
                                    <td>
                                        <strong>{s.name}</strong><br />
                                        <small style={{ color: 'var(--text-primary)', fontWeight: 700 }}>📱 {s.mobile || 'Not Provided'}</small><br />
                                        <small style={{ color: 'var(--text-muted)' }}>{s.email}</small>
                                    </td>
                                    <td><code>{s.enrollmentId || 'SIGMA-2026-REG'}</code></td>
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
                                    <td><strong>{s.allowedTests || 0} Tests</strong></td>
                                    <td>
                                        <span className={`badge ${s.remainingTests > 0 ? 'badge-success' : 'badge-danger'}`}>
                                            {s.remainingTests || 0} Tests Left
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                                            {(s.status || 'active').toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        {/* Action Buttons Pinned in One Clean Horizontal Line */}
                                        <div className="action-buttons-group" style={{ gap: '0.75rem' }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(s)}>
                                                Edit Details
                                            </button>
                                            <button 
                                                className={`btn ${s.status === 'active' ? 'btn-danger' : 'btn-primary'} btn-sm`}
                                                onClick={() => handleToggleStatus(s)}
                                            >
                                                {s.status === 'active' ? 'Disable' : 'Enable'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Quota & Student Modal */}
            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingStudent ? 'Edit Student Details & Quota' : 'Create Student Account'}
                maxWidth="600px"
                onSubmit={handleSave}
                footer={
                    <>
                        <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Save Student Details</button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input type="text" className="form-control" required value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">Mobile Number * (Mandatory - 10 Digits)</label>
                    <input type="tel" className="form-control" required maxLength={10} pattern="[0-9]{10}" value={mobile} onChange={e => setMobile(e.target.value.replace(/[^0-9]/g, ''))} placeholder="9876543210" />
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
                    <input type="number" className="form-control" required min="0" max="500" value={allowedTests} onChange={e => setAllowedTests(e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                    </select>
                </div>
            </Modal>
        </div>
    );
};
