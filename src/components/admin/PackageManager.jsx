import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { PackageRequestsQueue } from './PackageRequestsQueue.jsx';
import { Modal } from '../common/Modal.jsx';

export const PackageManager = ({ onRefresh }) => {
    const [subTab, setSubTab] = useState('packages'); // 'packages' | 'requests' | 'payment_config'
    const [packages, setPackages] = useState([]);
    const [exams, setExams] = useState([]);
    const [requestsCount, setRequestsCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPkg, setEditingPkg] = useState(null);

    // Form state — examId is the canonical link (Firestore exam doc id);
    // the exam's display name is derived from it at save time, not typed
    // freely, so packages always point at a real exam.
    const [packageName, setPackageName] = useState('');
    const [targetExamId, setTargetExamId] = useState('');
    const [totalTests, setTotalTests] = useState(100);
    const [price, setPrice] = useState(299);
    const [discountPrice, setDiscountPrice] = useState(199);
    const [validity, setValidity] = useState('12 Months');
    const [status, setStatus] = useState('active');

    // Merchant Payment Settings state
    const [merchantName, setMerchantName] = useState('SigmaForce CEP Official');
    const [upiId, setUpiId] = useState('sigmaforce@upi');
    const [razorpayKeyId, setRazorpayKeyId] = useState('rzp_test_E66NI3Yg44x1mj');
    const [qrImageUrl, setQrImageUrl] = useState('');
    const [settingsSavedMessage, setSettingsSavedMessage] = useState('');

    const loadPackages = async () => {
        setLoading(true);
        try {
            const list = await firestoreEngine.getPackages();
            setPackages(list);
        } catch (e) {
            console.error('Error loading packages:', e);
            setPackages([]);
        }

        try {
            const examList = await firestoreEngine.getExams();
            setExams(examList);
        } catch (e) {
            console.error('Error loading exams:', e);
            setExams([]);
        }

        const reqs = await firestoreEngine.getPackagePurchaseRequests();
        const pending = reqs.filter(r => r.status === 'pending').length;
        setRequestsCount(pending);

        const settings = await firestoreEngine.getMerchantPaymentSettings();
        if (settings) {
            setMerchantName(settings.merchantName || 'SigmaForce CEP Official');
            setUpiId(settings.upiId || 'sigmaforce@upi');
            setRazorpayKeyId(settings.razorpayKeyId || 'rzp_test_E66NI3Yg44x1mj');
            setQrImageUrl(settings.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi://pay?pa=${encodeURIComponent(settings.upiId || 'sigmaforce@upi')}%26pn=${encodeURIComponent(settings.merchantName || 'SigmaForce')}%26cu=INR`);
        }

        setLoading(false);
    };

    useEffect(() => {
        loadPackages();
    }, []);

    const handleSavePaymentSettings = async (e) => {
        e.preventDefault();
        const finalQrUrl = qrImageUrl.trim() || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi://pay?pa=${encodeURIComponent(upiId)}%26pn=${encodeURIComponent(merchantName)}%26cu=INR`;
        const updatedSettings = {
            merchantName: merchantName.trim(),
            upiId: upiId.trim(),
            razorpayKeyId: razorpayKeyId.trim(),
            qrImageUrl: finalQrUrl,
            updatedAt: new Date().toISOString()
        };

        await firestoreEngine.saveMerchantPaymentSettings(updatedSettings);
        setQrImageUrl(finalQrUrl);
        setSettingsSavedMessage('Merchant UPI Payment Settings & QR Code URL saved successfully!');
        setTimeout(() => setSettingsSavedMessage(''), 3000);
    };

    const handleOpenModal = (p = null) => {
        setEditingPkg(p);
        if (p) {
            setPackageName(p.name);
            // Legacy packages (created before examId existed) fall back to
            // matching their old free-text exam label against the real
            // exams list, so editing one doesn't show a blank selector.
            const resolvedExamId = p.examId || exams.find(ex => ex.name === p.exam)?.id || '';
            setTargetExamId(resolvedExamId);
            setTotalTests(p.totalTests);
            setPrice(p.price);
            setDiscountPrice(p.discountPrice || p.price);
            setValidity(p.validity);
            setStatus(p.status);
        } else {
            setPackageName('');
            setTargetExamId(exams[0]?.id || '');
            setTotalTests(100);
            setPrice(299);
            setDiscountPrice(199);
            setValidity('12 Months');
            setStatus('active');
        }
        setModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const pkgId = editingPkg ? editingPkg.id : 'pkg_' + Date.now();
        const selectedExam = exams.find(ex => ex.id === targetExamId);
        const pkgData = {
            id: pkgId,
            name: packageName,
            examId: targetExamId,
            exam: selectedExam?.name || selectedExam?.title || '',
            totalTests: parseInt(totalTests, 10),
            price: parseFloat(price),
            discountPrice: parseFloat(discountPrice),
            validity,
            status,
            createdAt: editingPkg ? editingPkg.createdAt : new Date().toISOString()
        };

        await firestoreEngine.savePackage(pkgData);
        await loadPackages();
        setModalOpen(false);
        if (onRefresh) onRefresh();
    };

    const handleToggleStatus = async (pkgId) => {
        const target = packages.find(p => p.id === pkgId);
        if (!target) return;
        const updated = { ...target, status: target.status === 'active' ? 'inactive' : 'active' };
        await firestoreEngine.savePackage(updated);
        await loadPackages();
    };

    const handleDelete = async (pkgId) => {
        if (!window.confirm('Are you sure you want to delete this course package?')) return;
        await firestoreEngine.deletePackage(pkgId);
        await loadPackages();
    };

    return (
        <div>
            {/* Sub Tabs for Packages vs Requests vs Payment Settings */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <button 
                    className={`btn ${subTab === 'packages' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSubTab('packages')}
                >
                    Course Packages Bundles
                </button>
                <button 
                    className={`btn ${subTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSubTab('requests')}
                >
                    UPI UTR Purchase Requests Queue
                    {requestsCount > 0 && (
                        <span className="badge badge-orange" style={{ marginLeft: '0.5rem' }}>
                            {requestsCount} Pending
                        </span>
                    )}
                </button>
                <button 
                    className={`btn ${subTab === 'payment_config' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSubTab('payment_config')}
                >
                    UPI Payment QR Code & Settings
                </button>
            </div>

            {subTab === 'requests' && <PackageRequestsQueue onRefresh={loadPackages} />}

            {subTab === 'payment_config' && (
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Merchant UPI Payment & QR Code Configuration</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Configure your official Merchant UPI ID and QR Code image shown to students during checkout.</p>
                        </div>
                    </div>

                    {settingsSavedMessage && (
                        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 700, marginBottom: '1.25rem' }}>
                            {settingsSavedMessage}
                        </div>
                    )}

                    <form onSubmit={handleSavePaymentSettings} className="two-col-grid-responsive">
                        <div>
                            <div className="form-group">
                                <label className="form-label">Merchant Business Name</label>
                                <input type="text" className="form-control" required value={merchantName} onChange={e => setMerchantName(e.target.value)} placeholder="e.g. SigmaForce CEP Official" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Merchant UPI ID *</label>
                                <input type="text" className="form-control" required value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="e.g. sigmaforce@upi or 9876543210@paytm" />
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>
                                    This UPI ID is displayed to students and embedded in the dynamic QR code generator.
                                </small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Razorpay API Key ID (Live / Test Key) *</label>
                                <input type="text" className="form-control" required value={razorpayKeyId} onChange={e => setRazorpayKeyId(e.target.value)} placeholder="e.g. rzp_live_xxxxxxxxxx or rzp_test_E66NI3Yg44x1mj" />
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>
                                    Your official Razorpay Dashboard Key ID for launching instant online payment checkouts.
                                </small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Custom QR Code Image URL (Optional)</label>
                                <input type="url" className="form-control" value={qrImageUrl} onChange={e => setQrImageUrl(e.target.value)} placeholder="Leave blank to auto-generate dynamic QR code from UPI ID" />
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>
                                    Provide an image link to your static PhonePe / Google Pay QR code image, or leave blank for dynamic generation.
                                </small>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                                Save Payment Settings
                            </button>
                        </div>

                        {/* Live QR Preview Box */}
                        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', textAlign: 'center' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Student Checkout Preview</h4>
                            
                            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'inline-block', border: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
                                <img 
                                    src={qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi://pay?pa=${encodeURIComponent(upiId)}%26pn=${encodeURIComponent(merchantName)}%26cu=INR`}
                                    alt="Merchant UPI QR Code"
                                    style={{ width: '180px', height: '180px', objectFit: 'contain' }}
                                />
                            </div>

                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{merchantName}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 800, marginTop: '0.2rem' }}><code>{upiId}</code></div>
                        </div>
                    </form>
                </div>
            )}

            {subTab === 'packages' && (
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
                                    <th style={{ minWidth: '260px', whiteSpace: 'nowrap' }}>Actions</th>
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
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                {/* Action Buttons Pinned in One Clean Horizontal Line */}
                                                <div className="action-buttons-group" style={{ gap: '0.75rem' }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(p)}>
                                                        Edit
                                                    </button>
                                                    <button 
                                                        className={`btn ${p.status === 'active' ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                                                        onClick={() => handleToggleStatus(p.id)}
                                                    >
                                                        {p.status === 'active' ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                    <button 
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => handleDelete(p.id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Package Creation & Edit Modal */}
                    <Modal
                        isOpen={modalOpen}
                        onClose={() => setModalOpen(false)}
                        title={editingPkg ? 'Edit Course Package' : 'Create Course Package'}
                        maxWidth="580px"
                        onSubmit={handleSave}
                        footer={
                            <>
                                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingPkg ? 'Save Package' : 'Create Package'}</button>
                            </>
                        }
                    >
                        <div className="form-group">
                            <label className="form-label">Package Name</label>
                            <input type="text" className="form-control" required value={packageName} onChange={e => setPackageName(e.target.value)} placeholder="e.g. Police Batch – 100 Tests" />
                        </div>

                        <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label className="form-label">Target Exam</label>
                                <select className="form-control" required value={targetExamId} onChange={e => setTargetExamId(e.target.value)}>
                                    <option value="" disabled>Select an exam...</option>
                                    {exams.map(ex => (
                                        <option key={ex.id} value={ex.id}>{ex.name}{ex.isFreeTest ? ' (Free Test)' : ''}</option>
                                    ))}
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
                    </Modal>
                </div>
            )}
        </div>
    );
};
