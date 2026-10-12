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

    // Creating a new student (login + profile)
    const [createPassword, setCreatePassword] = useState('');
    const [createBusy, setCreateBusy] = useState(false);
    const [createError, setCreateError] = useState('');

    // Password reset dialog (also used to show a new student's login details once)
    const [pwStudent, setPwStudent] = useState(null);
    const [pwInput, setPwInput] = useState('');
    const [pwBusy, setPwBusy] = useState(false);
    const [pwError, setPwError] = useState('');
    const [pwResult, setPwResult] = useState(null);   // { password, generated, email } once set
    const [pwCopied, setPwCopied] = useState(false);

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
        setCreateError('');
        setCreatePassword('');
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

        if (!editingStudent) {
            // A new student needs a real login, not just a profile — a profile with
            // no login behind it can never sign in. The server creates both.
            const typed = createPassword.trim();
            if (typed && typed.length < 8) {
                setCreateError('A password you type must be at least 8 characters. Leave it empty to generate one.');
                return;
            }
            setCreateBusy(true);
            setCreateError('');
            try {
                const res = await firestoreEngine.adminCreateStudent({
                    name: name.trim(),
                    email: email.trim(),
                    mobile: cleanMobile,
                    enrollmentId,
                    allowedTests: parseInt(allowedTests, 10) || 0,
                    password: typed
                });
                setModalOpen(false);
                setPwStudent({ name: name.trim(), email: res.email });
                setPwResult({ password: res.password, email: res.email, created: true });
                setPwCopied(false);
                await loadStudents();
                if (onRefresh) onRefresh();
            } catch (err) {
                setCreateError(err.message || 'Could not create the student.');
            } finally {
                setCreateBusy(false);
            }
            return;
        }

        const stdId = editingStudent.id || editingStudent.uid;
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

    const openPasswordReset = (std) => {
        setPwStudent(std);
        setPwInput('');
        setPwError('');
        setPwResult(null);
        setPwCopied(false);
    };

    const closePasswordReset = () => {
        if (pwBusy) return;
        setPwStudent(null);
        setPwResult(null);
        setPwInput('');
    };

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        if (!pwStudent) return;
        const typed = pwInput.trim();
        if (typed && typed.length < 8) {
            setPwError('A password you type must be at least 8 characters. Leave it empty to generate one.');
            return;
        }
        setPwBusy(true);
        setPwError('');
        try {
            const res = await firestoreEngine.adminResetStudentPassword({ uid: pwStudent.id || pwStudent.uid, password: typed });
            setPwResult(res);
        } catch (err) {
            setPwError(err.message || 'Could not reset the password.');
        } finally {
            setPwBusy(false);
        }
    };

    const copyPassword = async () => {
        try {
            await navigator.clipboard.writeText(pwResult.password);
            setPwCopied(true);
        } catch {
            setPwCopied(false);
        }
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
                            <th style={{ minWidth: '330px', whiteSpace: 'nowrap' }}>Actions</th>
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
                                            <button className="btn btn-secondary btn-sm" onClick={() => openPasswordReset(s)}>
                                                Reset Password
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
                        <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={createBusy}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={createBusy}>
                            {editingStudent ? 'Save Student Details' : (createBusy ? 'Creating...' : 'Create Student & Login')}
                        </button>
                    </>
                }
            >
                {!editingStudent && createError && (
                    <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '1rem' }}>
                        {createError}
                    </div>
                )}
                <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input type="text" className="form-control" required value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">Mobile Number * (Mandatory - 10 Digits)</label>
                    <input type="tel" className="form-control" required maxLength={10} pattern="[0-9]{10}" value={mobile} onChange={e => setMobile(e.target.value.replace(/[^0-9]/g, ''))} placeholder="9876543210" />
                </div>
                <div className="form-group">
                    <label className="form-label">Email Address * {editingStudent ? '(login email)' : '(they will sign in with this)'}</label>
                    <input
                        type="email"
                        className="form-control"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        readOnly={!!editingStudent}
                        style={editingStudent ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
                    />
                    {editingStudent && (
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            This is the email the student signs in with, so it cannot be changed here.
                        </small>
                    )}
                </div>
                {!editingStudent && (
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="text"
                            className="form-control"
                            value={createPassword}
                            onChange={e => setCreatePassword(e.target.value)}
                            placeholder="Leave empty to generate a strong password"
                            autoComplete="off"
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            Or type one (at least 8 characters). You will see it once after the account is created.
                        </small>
                    </div>
                )}
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

            {/* Reset a student login password */}
            <Modal
                isOpen={!!pwStudent}
                onClose={closePasswordReset}
                title={pwResult ? (pwResult.created ? 'Student account created' : 'New password ready') : 'Reset student password'}
                subtitle={pwStudent ? `${pwStudent.name || 'Student'} - ${pwStudent.email || ''}` : ''}
                maxWidth="520px"
                onSubmit={pwResult ? undefined : handlePasswordReset}
                footer={
                    pwResult ? (
                        <button type="button" className="btn btn-primary" onClick={closePasswordReset}>Done</button>
                    ) : (
                        <>
                            <button type="button" className="btn btn-secondary" onClick={closePasswordReset} disabled={pwBusy}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={pwBusy}>
                                {pwBusy ? 'Setting...' : 'Set new password'}
                            </button>
                        </>
                    )
                }
            >
                {pwResult ? (
                    <div>
                        <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                            {pwResult.created
                                ? <>The account for <strong>{pwResult.email || pwStudent?.email}</strong> has been created and can sign in now. Give the student these login details:</>
                                : <>The password for <strong>{pwResult.email || pwStudent?.email}</strong> has been changed. Give the student these login details:</>}
                        </p>
                        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.9rem 1rem', marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email</div>
                            <div style={{ fontWeight: 700, marginBottom: '0.6rem', wordBreak: 'break-all' }}>{pwResult.email || pwStudent?.email}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>New password</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <code style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '1px', color: 'var(--primary)' }}>{pwResult.password}</code>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={copyPassword}>
                                    {pwCopied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 700 }}>
                            This is the only time the password is shown - it is not saved anywhere. If it is lost, use Reset Password to set a new one.
                            {!pwResult.created && ' Any device still signed in with the old password will be signed out within about an hour.'}
                        </p>
                    </div>
                ) : (
                    <div>
                        {pwError && (
                            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '1rem' }}>
                                {pwError}
                            </div>
                        )}
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            Use this when a student has forgotten their password. The old password stops working immediately and you
                            will be shown the new one to pass on.
                        </p>
                        <div className="form-group">
                            <label className="form-label">New password</label>
                            <input
                                type="text"
                                className="form-control"
                                value={pwInput}
                                onChange={e => setPwInput(e.target.value)}
                                placeholder="Leave empty to generate a strong password"
                                autoComplete="off"
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                Or type your own (at least 8 characters).
                            </small>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
