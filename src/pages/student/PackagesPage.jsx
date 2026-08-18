import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { PackagePurchaseModal } from '../../components/student/PackagePurchaseModal.jsx';
import { DashboardShell } from '../../layouts/DashboardShell.jsx';

export const PackagesPage = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [packages, setPackages] = useState([]);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const [selectedPkg, setSelectedPkg] = useState(null);
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);

    const loadData = async () => {
        setLoading(true);
        const uid = user ? (user.id || user.uid) : null;
        if (uid) {
            const profile = await firestoreEngine.getUserProfile(uid);
            setUserProfile(profile);
        }
        const loadedPkgs = await firestoreEngine.getPackages();
        setPackages(loadedPkgs.filter(p => p.status === 'active'));
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [user]);

    const handleOpenPurchase = (pkg) => {
        setSelectedPkg(pkg);
        setPurchaseModalOpen(true);
    };

    return (
        <DashboardShell>
            <div>
                <div style={{ marginBottom: '1.75rem' }}>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.1rem', fontWeight: 800 }}>
                        {t('nav_new_package')}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                        {t('available_packages_desc')}
                    </p>
                </div>

                {loading ? (
                    <div className="card"><p style={{ color: 'var(--text-muted)' }}>Loading packages...</p></div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                        {packages.map(pkg => {
                            const alreadyPurchased = (userProfile?.purchasedPackages || []).some(p => p.packageId === pkg.id);
                            return (
                                <div key={pkg.id} style={{ background: 'var(--bg-surface)', border: alreadyPurchased ? '1px solid var(--success-border)' : '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span className="badge badge-purple">{pkg.exam}</span>
                                            {alreadyPurchased ? (
                                                <span className="badge badge-success">✓ Purchased</span>
                                            ) : (
                                                <span className="badge badge-success">{pkg.validity}</span>
                                            )}
                                        </div>
                                        <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.35rem' }}>{pkg.name}</h4>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                            Includes <strong>{pkg.totalTests} Full Length Blueprint Tests</strong> with detailed solutions & accuracy analytics.
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>₹{pkg.discountPrice || pkg.price}</span>
                                            {pkg.discountPrice && pkg.discountPrice < pkg.price && (
                                                <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.9rem' }}>₹{pkg.price}</span>
                                            )}
                                        </div>
                                    </div>

                                    {alreadyPurchased ? (
                                        <button className="btn btn-secondary" style={{ width: '100%', fontWeight: 700 }} disabled>
                                            ✓ Already Active
                                        </button>
                                    ) : (
                                        <button className="btn btn-primary" style={{ width: '100%', fontWeight: 700 }} onClick={() => handleOpenPurchase(pkg)}>
                                            Buy Package (UPI QR / UTR)
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <PackagePurchaseModal
                pkg={selectedPkg}
                isOpen={purchaseModalOpen}
                onClose={() => setPurchaseModalOpen(false)}
                onSuccess={loadData}
            />
        </DashboardShell>
    );
};
