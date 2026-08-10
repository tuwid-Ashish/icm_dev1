import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Modal } from '../common/Modal.jsx';

export const PackagePurchaseModal = ({ pkg, isOpen, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [utrNumber, setUtrNumber] = useState('');
    const [senderUpi, setSenderUpi] = useState(user?.mobile ? `${user.mobile}@ybl` : '');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const [paymentConfig, setPaymentConfig] = useState({
        merchantName: 'SigmaForce CEP Official',
        upiId: 'sigmaforce@upi',
        qrImageUrl: ''
    });

    useEffect(() => {
        let isMounted = true;
        async function loadConfig() {
            if (isOpen) {
                const cfg = await firestoreEngine.getMerchantPaymentSettings();
                if (isMounted && cfg) {
                    setPaymentConfig({
                        merchantName: cfg.merchantName || 'SigmaForce CEP Official',
                        upiId: cfg.upiId || 'sigmaforce@upi',
                        qrImageUrl: cfg.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi://pay?pa=${encodeURIComponent(cfg.upiId || 'sigmaforce@upi')}%26pn=${encodeURIComponent(cfg.merchantName || 'SigmaForce')}%26cu=INR`
                    });
                }
            }
        }
        loadConfig();
        return () => { isMounted = false; };
    }, [isOpen]);

    if (!isOpen || !pkg) return null;

    const amountToPay = pkg.discountPrice || pkg.price;
    const qrSource = paymentConfig.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi://pay?pa=${encodeURIComponent(paymentConfig.upiId)}%26pn=${encodeURIComponent(paymentConfig.merchantName)}%26cu=INR`;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedUtr = utrNumber.trim();
        if (trimmedUtr.length !== 12 || !/^\d{12}$/.test(trimmedUtr)) {
            setErrorMessage('Please enter a valid 12-digit numeric UPI UTR / Transaction Reference Number.');
            return;
        }

        if (!senderUpi.trim()) {
            setErrorMessage('Please enter your Sender UPI ID or Mobile Number.');
            return;
        }

        setLoading(true);
        setErrorMessage('');

        const requestData = {
            id: 'req_' + Date.now(),
            studentId: user?.id || user?.uid || 'std_101',
            studentName: user?.name || 'Alex Student',
            studentEmail: user?.email || 'student@sigma.com',
            studentMobile: user?.mobile || '9876543210',
            packageId: pkg.id,
            packageName: pkg.name,
            targetExam: pkg.exam,
            testQuota: pkg.totalTests,
            amount: amountToPay,
            utrNumber: trimmedUtr,
            senderUpi: senderUpi.trim(),
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        const res = await firestoreEngine.savePackagePurchaseRequest(requestData);
        setLoading(false);

        if (!res.success) {
            setErrorMessage(res.message || 'Error submitting purchase request.');
            return;
        }

        setSuccessMessage('Payment submission received! Your 12-digit UTR has been sent to Admin for verification.');
        
        setTimeout(() => {
            if (onSuccess) onSuccess();
            onClose();
        }, 2500);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Course Package Checkout"
            subtitle="Scan UPI QR Code, complete payment & submit 12-digit UTR number"
            maxWidth="540px"
            onSubmit={!successMessage ? handleSubmit : undefined}
            footer={!successMessage ? (
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Submitting UTR...' : 'Submit Payment UTR for Verification'}
                    </button>
                </>
            ) : undefined}
        >
            {successMessage ? (
                <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', padding: '1.25rem', borderRadius: 'var(--radius-md)', textAlign: 'center', fontWeight: 700 }}>
                    {successMessage}
                </div>
            ) : (
                <>
                    {/* Package Summary Header Card */}
                    <div style={{ background: 'var(--bg-subtle)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{pkg.name}</strong><br />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Exam: {pkg.exam} | Quota: {pkg.totalTests} Tests</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--success)' }}>₹{amountToPay}</div>
                            {pkg.discountPrice && pkg.discountPrice < pkg.price && (
                                <small style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>₹{pkg.price}</small>
                            )}
                        </div>
                    </div>

                    {/* UPI QR Code & Merchant Details Box */}
                    <div style={{ border: '2px dashed var(--primary-border)', background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', textAlign: 'center', marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                            Step 1: Scan Official UPI QR Code
                        </div>

                        {/* Configured Merchant QR Code Image */}
                        <div style={{ width: '180px', height: '180px', margin: '0 auto 0.75rem', background: '#ffffff', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img 
                                src={qrSource}
                                alt="Official Merchant UPI QR Code"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                        </div>

                        <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            {paymentConfig.merchantName}
                        </div>
                        <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                            Merchant UPI ID: <code style={{ background: 'var(--bg-subtle)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontWeight: 800, color: 'var(--primary)' }}>{paymentConfig.upiId}</code>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Pay exact amount: <strong style={{ color: 'var(--success)' }}>₹{amountToPay}</strong>
                        </div>
                    </div>

                    {/* Step 2: Verification Input */}
                    <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: '0.5px', marginBottom: '1rem' }}>
                            Step 2: Enter Transaction Payment Details
                        </div>

                        {errorMessage && (
                            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem' }}>
                                {errorMessage}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">12-Digit UPI UTR / Transaction Ref No *</label>
                            <input 
                                type="text" 
                                className="form-control" 
                                required 
                                maxLength="12"
                                value={utrNumber} 
                                onChange={e => setUtrNumber(e.target.value.replace(/\D/g, ''))}
                                placeholder="e.g. 422198034120 (12 digits)" 
                                style={{ fontFamily: 'monospace', letterSpacing: '1px', fontSize: '1rem' }}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                                Find this 12-digit UTR in PhonePe / GPay / Paytm payment receipt details.
                            </small>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Your Sender UPI ID / Mobile *</label>
                            <input 
                                type="text" 
                                className="form-control" 
                                required 
                                value={senderUpi} 
                                onChange={e => setSenderUpi(e.target.value)}
                                placeholder="e.g. 9876543210@ybl or rahul@okicici" 
                            />
                        </div>
                    </div>
                </>
            )}
        </Modal>
    );
};
