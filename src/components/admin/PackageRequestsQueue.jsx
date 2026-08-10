import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';

export const PackageRequestsQueue = ({ onRefresh }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ALL');

    const loadRequests = async () => {
        setLoading(true);
        const loaded = await firestoreEngine.getPackagePurchaseRequests();
        setRequests(loaded);
        setLoading(false);
    };

    useEffect(() => {
        loadRequests();
    }, []);

    let filtered = requests;
    if (statusFilter !== 'ALL') {
        filtered = filtered.filter(r => r.status === statusFilter);
    }

    const handleApprove = async (reqId) => {
        if (!window.confirm('Are you sure you want to verify UTR and approve this package purchase request?')) return;
        const res = await firestoreEngine.approvePackagePurchaseRequest(reqId);
        if (res.success) {
            alert('Package purchase request approved! Test quota and package credited to student account.');
            await loadRequests();
            if (onRefresh) onRefresh();
        } else {
            alert(res.message || 'Error approving request.');
        }
    };

    const handleReject = async (reqId) => {
        if (!window.confirm('Are you sure you want to reject this purchase request?')) return;
        const res = await firestoreEngine.rejectPackagePurchaseRequest(reqId);
        if (res.success) {
            await loadRequests();
            if (onRefresh) onRefresh();
        }
    };

    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
        <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 className="card-title">
                        Package Purchase Requests Queue 
                        {pendingCount > 0 && (
                            <span className="badge badge-orange" style={{ marginLeft: '0.75rem' }}>
                                {pendingCount} Pending Verification
                            </span>
                        )}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Verify student 12-digit UTR payment reference numbers and approve package test quotas.</p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select 
                        className="form-control" 
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        style={{ maxWidth: '220px' }}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="pending">Pending Verification ({pendingCount})</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Student & Mobile</th>
                            <th>Package Requested</th>
                            <th>Amount Paid</th>
                            <th>12-Digit UTR Ref No</th>
                            <th>Sender UPI ID</th>
                            <th>Submitted Date</th>
                            <th>Status</th>
                            <th style={{ minWidth: '220px', whiteSpace: 'nowrap' }}>Verification Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading package requests...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No package purchase requests found.</td></tr>
                        ) : (
                            filtered.map(r => (
                                <tr key={r.id}>
                                    <td>
                                        <strong>{r.studentName}</strong><br />
                                        <small style={{ color: 'var(--text-primary)', fontWeight: 700 }}>📱 {r.studentMobile || '9876543210'}</small><br />
                                        <small style={{ color: 'var(--text-muted)' }}>{r.studentEmail}</small>
                                    </td>
                                    <td>
                                        <strong>{r.packageName}</strong><br />
                                        <small style={{ color: 'var(--text-muted)' }}>Exam: {r.targetExam} | Quota: +{r.testQuota} Tests</small>
                                    </td>
                                    <td><strong style={{ color: 'var(--success)' }}>₹{r.amount}</strong></td>
                                    <td>
                                        <code style={{ background: 'var(--bg-subtle)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)' }}>
                                            {r.utrNumber}
                                        </code>
                                    </td>
                                    <td><small>{r.senderUpi}</small></td>
                                    <td><small>{new Date(r.createdAt).toLocaleString()}</small></td>
                                    <td>
                                        <span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'pending' ? 'badge-orange' : 'badge-danger'}`}>
                                            {r.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        {r.status === 'pending' ? (
                                            <div className="action-buttons-group" style={{ gap: '0.75rem' }}>
                                                <button className="btn btn-primary btn-sm" onClick={() => handleApprove(r.id)}>
                                                    Approve & Credit
                                                </button>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleReject(r.id)}>
                                                    Reject
                                                </button>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                {r.status === 'approved' ? 'Credited' : 'Rejected'}
                                            </span>
                                        )}
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
