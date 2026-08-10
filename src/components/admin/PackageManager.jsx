import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';

export const PackageManager = ({ onRefresh }) => {
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPkg, setEditingPkg] = useState(null);

    // Form state
    const [packageName, setPackageName] = useState('');
    const [targetExam, setTargetExam] = useState('Police Bharti');
    const [totalTests, setTotalTests] = useState(100);
    const [price, setPrice] = useState(299);
    const [discountPrice, setDiscountPrice] = useState(199);
    const [validity, setValidity] = useState('12 Months');
    const [status, setStatus] = useState('active');

    const loadPackages = async () => {
        setLoading(true);
        // Load from storage service / local storage fallback
        const local = localStorage.getItem('sigma_course_packages');
        const list = local ? JSON.parse(local) : [
            { id: 'pkg_1', name: 'Police Batch – 100 Tests', exam: 'Police Bharti', totalTests: 100, price: 299, discountPrice: 199, validity: '12 Months', status: 'active' },
            { id: 'pkg_2', name: 'SSC GD – 100 Tests', exam: 'SSC GD', totalTests: 100, price: 299, discountPrice: 199, validity: '12 Months', status: 'active' },
            { id: 'pkg_3', name: 'Vanrakshak – 100 Tests', exam: 'Vanrakshak', totalTests: 100, price: 299, discountPrice: 199, validity: '12 Months', status: 'active' }
        ];
        setPackages(list);
        setLoading(false);
    };

    useEffect(() => {
        loadPackages();
    }, []);

    const handleOpenModal = (p = null) => {
        setEditingPkg(p);
        if (p) {
            setPackageName(p.name);
            setTargetExam(p.exam);
            setTotalTests(p.totalTests);
            setPrice(p.price);
            setDiscountPrice(p.discountPrice || p.price);
            setValidity(p.validity);
            setStatus(p.status);
        } else {
            setPackageName('Police Batch – 100 Tests');
            setTargetExam('Police Bharti');
            setTotalTests(100);
            setPrice(299);
            setDiscountPrice(199);
            setValidity('12 Months');
            setStatus('active');
        }
        setModalOpen(true);
    };

    const handleSave = (e) => {
        e.preventDefault();
        const pkgId = editingPkg ? editingPkg.id : 'pkg_' + Date.now();
        const pkgData = {
            id: pkgId,
            name: packageName,
            exam: targetExam,
            totalTests: parseInt(totalTests, 10),
            price: parseFloat(price),
            discountPrice: parseFloat(discountPrice),
            validity,
            status,
            createdAt: editingPkg ? editingPkg.createdAt : new Date().toISOString()
        };

        const existingIdx = packages.findIndex(p => p.id === pkgId);
        let updated;
        if (existingIdx >= 0) {
            updated = packages.map(p => p.id === pkgId ? pkgData : p);
        } else {
            updated = [...packages, pkgData];
        }

        localStorage.setItem('sigma_course_packages', JSON.stringify(updated));
        setPackages(updated);
        setModalOpen(false);
        if (onRefresh) onRefresh();
    };

    const handleToggleStatus = (pkgId) => {
        const updated = packages.map(p => p.id === pkgId ? { ...p, status: p.status === 'active' ? 'inactive' : 'active' } : p);
        localStorage.setItem('sigma_course_packages', JSON.stringify(updated));
        setPackages(updated);
    };

    const handleDelete = (pkgId) => {
        if (!window.confirm('Are you sure you want to delete this course package?')) return;
        const updated = packages.filter(p => p.id !== pkgId);
        localStorage.setItem('sigma_course_packages', JSON.stringify(updated));
        setPackages(updated);
    };

    return (
        <div className="card">
            <div className="card-header">
                <div>
                    <h3 className="card-title">Course & Exam Packages Management</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Create and manage student test packages, pricing, test quotas, and validity durations.</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal(null)}>
                    + Create Course Package
                </button>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Package Name</th>
                            <th>Target Exam</th>
                            <th>Test Quota</th>
                            <th>Pricing</th>
                            <th>Validity</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading course packages...</td></tr>
                        ) : (
                            packages.map(p => (
                                <tr key={p.id}>
                                    <td><strong>{p.name}</strong></td>
                                    <td><span className="badge badge-purple">{p.exam}</span></td>
                                    <td><strong>{p.totalTests} Tests</strong></td>
                                    <td>
                                        <strong style={{ color: 'var(--success)' }}>₹{p.discountPrice || p.price}</strong>
                                        {p.discountPrice && p.discountPrice < p.price && (
                                            <small style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>₹{p.price}</small>
                                        )}
                                    </td>
                                    <td>{p.validity}</td>
                                    <td>
                                        <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                                            {p.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(p)}>
                                            Edit
                                        </button>
                                        <button 
                                            className={`btn ${p.status === 'active' ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                                            style={{ marginLeft: '0.35rem' }}
                                            onClick={() => handleToggleStatus(p.id)}
                                        >
                                            {p.status === 'active' ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button 
                                            className="btn btn-danger btn-sm"
                                            style={{ marginLeft: '0.35rem' }}
                                            onClick={() => handleDelete(p.id)}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Package Form Modal */}
            {modalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-card" style={{ maxWidth: '580px' }}>
                        <div className="modal-header" style={{ marginBottom: '1.25rem' }}>
                            <h3 className="card-title">{editingPkg ? 'Edit Course Package' : 'Create Course Package'}</h3>
                            <button className="modal-close" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Package Name</label>
                                <input type="text" className="form-control" required value={packageName} onChange={e => setPackageName(e.target.value)} placeholder="e.g. Police Batch – 100 Tests" />
                            </div>

                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Target Exam / Batch</label>
                                    <select className="form-control" value={targetExam} onChange={e => setTargetExam(e.target.value)}>
                                        <option value="Police Bharti">Police Bharti</option>
                                        <option value="Vanrakshak">Vanrakshak (Forest Guard)</option>
                                        <option value="SSC GD">SSC GD Constable</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Number of Included Tests</label>
                                    <input type="number" className="form-control" required min="1" max="500" value={totalTests} onChange={e => setTotalTests(e.target.value)} />
                                </div>
                            </div>

                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Original Price (₹)</label>
                                    <input type="number" className="form-control" required min="0" value={price} onChange={e => setPrice(e.target.value)} />
                                </div>
                                <div>
                                    <label className="form-label">Offer Price (₹)</label>
                                    <input type="number" className="form-control" min="0" value={discountPrice} onChange={e => setDiscountPrice(e.target.value)} />
                                </div>
                                <div>
                                    <label className="form-label">Validity Period</label>
                                    <input type="text" className="form-control" required value={validity} onChange={e => setValidity(e.target.value)} placeholder="e.g. 12 Months" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Package Status</label>
                                <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingPkg ? 'Save Package' : 'Create Package'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
