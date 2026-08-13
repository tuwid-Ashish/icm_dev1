import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { Modal } from '../common/Modal.jsx';

export const PackagePurchaseModal = ({ pkg, isOpen, onClose, onSuccess }) => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [utrNumber, setUtrNumber] = useState('');
    const [senderUpi, setSenderUpi] = useState(user?.mobile ? `${user.mobile}@ybl` : '');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [successPaymentId, setSuccessPaymentId] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [paymentMethodTab, setPaymentMethodTab] = useState('razorpay'); // 'razorpay' | 'manual_utr'

    const [paymentConfig, setPaymentConfig] = useState({
        merchantName: 'SigmaForce CEP Official',
        upiId: 'sigmaforce@upi',
        razorpayKeyId: 'rzp_test_E66NI3Yg44x1mj',
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
                        razorpayKeyId: cfg.razorpayKeyId || 'rzp_test_E66NI3Yg44x1mj',
                        qrImageUrl: cfg.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi://pay?pa=${encodeURIComponent(cfg.upiId || 'sigmaforce@upi')}%26pn=${encodeURIComponent(cfg.merchantName || 'SigmaForce')}%26cu=INR`
                    });
                }
            }
        }
        loadConfig();

        // Inject Razorpay checkout script dynamically
        if (!document.getElementById('razorpay-checkout-js')) {
            const script = document.createElement('script');
            script.id = 'razorpay-checkout-js';
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            document.body.appendChild(script);
        }

        return () => { isMounted = false; };
    }, [isOpen]);

    if (!isOpen || !pkg) return null;

    const amountToPay = pkg.discountPrice || pkg.price;
    const qrSource = paymentConfig.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi://pay?pa=${encodeURIComponent(paymentConfig.upiId)}%26pn=${encodeURIComponent(paymentConfig.merchantName)}%26cu=INR`;

    // Trigger Official Razorpay Gateway Popup — order is created server-side
    // (/api/razorpay/create-order) so the Key Secret never touches the browser,
    // and the resulting order_id lets us cryptographically verify the payment
    // afterwards instead of trusting whatever the client-side handler receives.
    const handleRazorpayPayment = async () => {
        setErrorMessage('');
        setLoading(true);

        let order;
        try {
            order = await firestoreEngine.createRazorpayOrder({
                amount: amountToPay,
                packageId: pkg.id
            });
        } catch (err) {
            setLoading(false);
            setErrorMessage('Could not start checkout: ' + (err.message || 'Server order creation failed.'));
            return;
        }

        const options = {
            key: order.keyId,
            order_id: order.orderId,
            amount: order.amount, // paise, from the server-created order
            currency: order.currency,
            name: paymentConfig.merchantName || 'SigmaForce CEP Official',
            description: `${pkg.name} (${pkg.totalTests} Tests)`,
            image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
            prefill: {
                name: user?.name || 'Student Name',
                email: user?.email || 'student@sigma.com',
                contact: user?.mobile || '9876543210'
            },
            theme: {
                color: '#ea580c'
            },
            handler: async function (response) {
                const res = await firestoreEngine.verifyRazorpayPayment({
                    orderId: response.razorpay_order_id,
                    paymentId: response.razorpay_payment_id,
                    signature: response.razorpay_signature,
                    student: user,
                    pkg,
                    amount: amountToPay
                });
                setLoading(false);

                if (res.success) {
                    setSuccessPaymentId(response.razorpay_payment_id);
                    setSuccessMessage(t('quota_credited_msg'));
                    setTimeout(() => {
                        if (onSuccess) onSuccess(res.user);
                        onClose();
                    }, 3000);
                } else {
                    setErrorMessage(res.error || 'Payment verification failed.');
                }
            },
            modal: {
                ondismiss: function () {
                    setLoading(false);
                }
            }
        };

        if (window.Razorpay) {
            try {
                const rzp = new window.Razorpay(options);
                rzp.on('payment.failed', function (response) {
                    setLoading(false);
                    const desc = response.error ? (response.error.description || response.error.reason) : 'Invalid Razorpay Key ID or cancelled transaction.';
                    setErrorMessage('Razorpay Gateway Notice: ' + desc + '. Please check your Razorpay Key ID in Admin Settings.');
                });
                rzp.open();
            } catch (err) {
                setLoading(false);
                setErrorMessage('Razorpay Popup Error: ' + (err.message || 'Could not open gateway popup. Check Key ID in Admin Settings.'));
            }
        } else {
            setLoading(false);
            setErrorMessage('Razorpay checkout script did not load. Use "Simulate Instant Quota Credit" for sandbox testing instead.');
        }
    };

    // Instant Simulated Test Payment for sandbox testing without real Razorpay account
    const handleSimulatedPayment = async () => {
        setLoading(true);
        setErrorMessage('');
        const mockPaymentId = 'pay_sim_' + Math.random().toString(36).substring(2, 10);
        const res = await firestoreEngine.processRazorpayPaymentSuccess({
            student: user,
            pkg,
            paymentId: mockPaymentId,
            amount: amountToPay
        });
        setLoading(false);
        if (res.success) {
            setSuccessPaymentId(mockPaymentId);
            setSuccessMessage(t('quota_credited_msg'));
            setTimeout(() => {
                if (onSuccess) onSuccess(res.user);
                onClose();
            }, 2500);
        } else {
            setErrorMessage('Simulated payment failed.');
        }
    };

    const handleManualUtrSubmit = async (e) => {
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
            title={t('razorpay_modal_title')}
            subtitle={t('razorpay_modal_subtitle')}
            maxWidth="540px"
        >
            {successMessage ? (
                <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>{t('payment_successful_title')}</h3>
                    <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>{successMessage}</p>
                    {successPaymentId && (
                        <div style={{ background: 'var(--bg-surface)', padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'inline-block', fontSize: '0.85rem' }}>
                            {t('razorpay_payment_id_label')}: <code style={{ color: 'var(--primary)', fontWeight: 800 }}>{successPaymentId}</code>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Package Summary Header Card */}
                    <div style={{ background: 'var(--bg-subtle)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{pkg.name}</strong><br />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{pkg.exam} | Quota: {pkg.totalTests} Tests</span>
                        </div>
                        <div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--success)' }}>₹{amountToPay}</div>
                            {pkg.discountPrice && pkg.discountPrice < pkg.price && (
                                <small style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>₹{pkg.price}</small>
                            )}
                        </div>
                    </div>

                    {/* Payment Method Switcher Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: 'var(--bg-subtle)', padding: '0.35rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <button
                            type="button"
                            onClick={() => setPaymentMethodTab('razorpay')}
                            style={{
                                flex: 1,
                                padding: '0.6rem',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                background: paymentMethodTab === 'razorpay' ? 'var(--primary)' : 'transparent',
                                color: paymentMethodTab === 'razorpay' ? '#ffffff' : 'var(--text-muted)'
                            }}
                        >
                            💳 Razorpay Instant Gateway
                        </button>
                        <button
                            type="button"
                            onClick={() => setPaymentMethodTab('manual_utr')}
                            style={{
                                flex: 1,
                                padding: '0.6rem',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                background: paymentMethodTab === 'manual_utr' ? 'var(--primary)' : 'transparent',
                                color: paymentMethodTab === 'manual_utr' ? '#ffffff' : 'var(--text-muted)'
                            }}
                        >
                            📲 Manual QR & UTR
                        </button>
                    </div>

                    {errorMessage && (
                        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem' }}>
                            {errorMessage}
                        </div>
                    )}

                    {paymentMethodTab === 'razorpay' ? (
                        <div style={{ border: '2px solid var(--primary-border)', background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                                Secure Checkout via Razorpay
                            </h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                                Instant activation via UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, Netbanking & Wallets.
                            </p>

                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={loading}
                                onClick={handleRazorpayPayment}
                                style={{ width: '100%', padding: '0.9rem', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            >
                                {loading ? (
                                    <span>Opening Razorpay Gateway...</span>
                                ) : (
                                    <span>⚡ {t('pay_via_razorpay_btn')} (₹{amountToPay})</span>
                                )}
                            </button>

                            <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={loading}
                                onClick={handleSimulatedPayment}
                                style={{ width: '100%', marginTop: '0.65rem', padding: '0.65rem', fontSize: '0.85rem', fontWeight: 700 }}
                            >
                                🧪 Test Mode: Simulate Instant Quota Credit (Without Key)
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleManualUtrSubmit}>
                            {/* UPI QR Code & Merchant Details Box */}
                            <div style={{ border: '2px dashed var(--primary-border)', background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', textAlign: 'center', marginBottom: '1.25rem' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                                    Scan Merchant UPI QR Code
                                </div>

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
                                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                                    Merchant UPI ID: <code style={{ background: 'var(--bg-subtle)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontWeight: 800, color: 'var(--primary)', wordBreak: 'break-all' }}>{paymentConfig.upiId}</code>
                                </div>
                            </div>

                            <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                                <div className="form-group">
                                    <label className="form-label">12-Digit UPI UTR / Transaction Ref No *</label>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        required 
                                        maxLength="12"
                                        value={utrNumber} 
                                        onChange={e => setUtrNumber(e.target.value.replace(/\D/g, ''))}
                                        placeholder="e.g. 422198034120" 
                                        style={{ fontFamily: 'monospace', letterSpacing: '1px', fontSize: '1rem' }}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Your Sender UPI ID / Mobile *</label>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        required 
                                        value={senderUpi} 
                                        onChange={e => setSenderUpi(e.target.value)}
                                        placeholder="e.g. 9876543210@ybl" 
                                    />
                                </div>

                                <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
                                    {loading ? 'Submitting UTR...' : 'Submit Payment UTR for Verification'}
                                </button>
                            </div>
                        </form>
                    )}
                </>
            )}
        </Modal>
    );
};

