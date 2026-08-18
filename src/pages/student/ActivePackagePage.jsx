import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { DashboardShell } from '../../layouts/DashboardShell.jsx';

export const ActivePackagePage = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const uid = user ? (user.id || user.uid) : null;
            if (uid) {
                const profile = await firestoreEngine.getUserProfile(uid);
                setUserProfile(profile);
            }
            setLoading(false);
        })();
    }, [user]);

    const purchased = userProfile?.purchasedPackages || [];

    return (
        <DashboardShell>
            <div>
                <div style={{ marginBottom: '1.75rem' }}>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.1rem', fontWeight: 800 }}>
                        {t('nav_active_package')}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                        {t('nav_active_package_desc')}
                    </p>
                </div>

                {loading ? (
                    <div className="card"><p style={{ color: 'var(--text-muted)' }}>Loading your packages...</p></div>
                ) : purchased.length === 0 ? (
                    <div className="card">
                        <p style={{ color: 'var(--text-muted)' }}>You haven't purchased any packages yet.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                        {purchased.map((p, idx) => (
                            <div key={p.id || idx} className="card" style={{ margin: 0 }}>
                                <span className="badge badge-purple">{p.exam}</span>
                                <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 800, margin: '0.5rem 0' }}>
                                    {p.packageName}
                                </h4>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    <div>Total Tests: <strong style={{ color: 'var(--text-primary)' }}>{p.totalTests ?? '—'}</strong></div>
                                    <div>Purchase Date: <strong style={{ color: 'var(--text-primary)' }}>{p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString() : '—'}</strong></div>
                                    <div>Payment Status: <strong style={{ color: 'var(--text-primary)' }}>{p.paymentStatus || '—'}</strong></div>
                                    {p.expiry && <div>Validity: <strong style={{ color: 'var(--text-primary)' }}>{p.expiry}</strong></div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
};
