import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { Modal } from '../common/Modal.jsx';

export const PackagePurchaseModal = ({ pkg, isOpen, onClose, onSuccess }) => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [successPaymentId, setSuccessPaymentId] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    // Set when the gateway has taken the money but crediting failed. While it
    // is set the pay button is hidden: the student has already paid, and a
    // second payment would be a second charge for the same package.
    const [paymentIssue, setPaymentIssue] = useState(null);

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

    // Ask the server to credit a payment the gateway has already captured.
    // Safe to call repeatedly with the same ids: the server credits a given
    // payment id at most once, so "try again" can never double-credit.
    const creditPayment = async (ids) => {
        setLoading(true);
        setErrorMessage('');
        const res = await firestoreEngine.verifyRazorpayPayment({ ...ids, packageId: pkg.id });
        setLoading(false);

        if (res.success) {
            setPaymentIssue(null);
            setSuccessPaymentId(ids.paymentId);
            setSuccessMessage(res.message || t('quota_credited_msg'));
            setTimeout(() => {
                // The server wrote the quota; re-read the profile
                // rather than trusting a locally-built user object.
                if (onSuccess) onSuccess();
                onClose();
            }, 3000);
        } else {
            setPaymentIssue({ ...ids, message: res.error, retryable: !!res.retryable });
        }
    };

    // Trigger Official Razorpay Gateway Popup — order is created server-side
    // (/api/razorpay/create-order) so the Key Secret never touches the browser,
    // and the resulting order_id lets us cryptographically verify the payment
    // afterwards instead of trusting whatever the client-side handler receives.
    const handleRazorpayPayment = async () => {
        setErrorMessage('');
        setLoading(true);

        let order;
        try {
            order = await firestoreEngine.createRazorpayOrder({ packageId: pkg.id });
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
            handler: function (response) {
                // Only the ids go to the server. It takes the buyer from the
                // Firebase ID token, the price and quota from the package
                // document, and the amount paid from the Razorpay API — so
                // there is nothing here worth tampering with.
                return creditPayment({
                    orderId: response.razorpay_order_id,
                    paymentId: response.razorpay_payment_id,
                    signature: response.razorpay_signature
                });
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
    // const handleSimulatedPayment = async () => {
    //     setLoading(true);
    //     setErrorMessage('');
    //     const mockPaymentId = 'pay_sim_' + Math.random().toString(36).substring(2, 10);
    //     const res = await firestoreEngine.processRazorpayPaymentSuccess({
    //         student: user,
    //         pkg,
    //         paymentId: mockPaymentId,
    //         amount: amountToPay
    //     });
    //     setLoading(false);
    //     if (res.success) {
    //         setSuccessPaymentId(mockPaymentId);
    //         setSuccessMessage(t('quota_credited_msg'));
    //         setTimeout(() => {
    //             if (onSuccess) onSuccess(res.user);
    //             onClose();
    //         }, 2500);
    //     } else {
    //         setErrorMessage('Simulated payment failed.');
    //     }
    // };


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

                    {errorMessage && !paymentIssue && (
                        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem' }}>
                            {errorMessage}
                        </div>
                    )}

                    {/* Razorpay is the only checkout route. The manual UPI QR + UTR
                        flow was removed from the UI; firestoreEngine.savePackagePurchaseRequest
                        and the admin approval queue remain for historical requests. */}
                    {paymentIssue ? (
                        <div role="alert" style={{ border: '2px solid var(--danger-border)', background: 'var(--danger-bg)', padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--danger)', marginBottom: '0.6rem' }}>
                                Payment received — your package is not added yet
                            </h4>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                                {paymentIssue.message} <strong>Please do not pay again.</strong> Your money is safe and
                                the package will be added to your account.
                            </p>
                            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                                Payment ID: <code style={{ fontWeight: 800, color: 'var(--primary)', wordBreak: 'break-all' }}>{paymentIssue.paymentId}</code>
                                <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                    Keep this ID and share it with support if the package does not appear.
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                {paymentIssue.retryable && (
                                    <button type="button" className="btn btn-primary" disabled={loading}
                                        onClick={() => creditPayment({ orderId: paymentIssue.orderId, paymentId: paymentIssue.paymentId, signature: paymentIssue.signature })}>
                                        {loading ? 'Trying…' : 'Try adding my package again'}
                                    </button>
                                )}
                                <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
                            </div>
                        </div>
                    ) : (
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
                        </div>
                    )}
                </>
            )}
        </Modal>
    );
};

