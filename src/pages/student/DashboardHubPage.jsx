import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { NavActionCard } from '../../components/common/NavActionCard.jsx';
import { DashboardShell } from '../../layouts/DashboardShell.jsx';

// The dashboard hub (/dashboard) — quota overview + navigation only. Every
// destination below is its own dedicated page (client requirement: one
// focused screen per thing, not everything scrolled together on one page).
export const DashboardHubPage = () => {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [userProfile, setUserProfile] = useState(null);
    const [submissions, setSubmissions] = useState([]);

    useEffect(() => {
        (async () => {
            const uid = user ? (user.id || user.uid) : null;
            if (!uid) return;
            const profile = await firestoreEngine.getUserProfile(uid);
            setUserProfile(profile);
            const subs = await firestoreEngine.getSubmissions(uid);
            setSubmissions(subs);
        })();
    }, [user]);

    return (
        <DashboardShell>
            <div style={{ width: '100%' }}>
                <div className="stats-grid">
                    <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                        <div className="stat-title">📊 {t('remaining_tokens')}</div>
                        <div className="stat-val" style={{ color: 'var(--primary)' }}>{userProfile ? (userProfile.remainingTests || 0) : 0} {t('tokens_unit')}</div>
                        <div className="stat-sub">
                            {userProfile && (userProfile.remainingTests > 0) ? t('active_subscription') : t('no_tests_left')}
                        </div>
                    </div>

                    <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
                        <div className="stat-title">✅ {t('completed_mock_tests')}</div>
                        <div className="stat-val" style={{ color: 'var(--success)' }}>{submissions.length} {t('attempted_unit')}</div>
                        <div className="stat-sub">{t('scorecards_evaluated')}</div>
                    </div>
                </div>

                <div className="nav-actions-grid">
                    <NavActionCard
                        icon="📝"
                        color="#dc2626"
                        title={t('nav_exam_catalog')}
                        description={t('nav_exam_catalog_desc')}
                        onClick={() => router.push('/dashboard/exams')}
                    />
                    <NavActionCard
                            icon="🆓"
                            color="#16a34a"
                            title={t('nav_free_tests')}
                            description={t('nav_free_tests_desc')}
                            onClick={() => router.push('/dashboard/free-tests')}
                        />
                    <NavActionCard
                        icon="📄"
                        color="#4338ca"
                        title={t('nav_active_package')}
                        description={t('nav_active_package_desc')}
                        onClick={() => router.push('/dashboard/active-package')}
                    />
                    <NavActionCard
                        icon="🕐"
                        color="#0891b2"
                        title={t('nav_test_history')}
                        description={t('nav_test_history_desc')}
                        onClick={() => router.push('/dashboard/history')}
                    />
                    <NavActionCard
                        icon="🛍️"
                        color="#ea580c"
                        title={t('nav_new_package')}
                        description={t('nav_new_package_desc')}
                        onClick={() => router.push('/dashboard/packages')}
                    />
                </div>
            </div>
        </DashboardShell>
    );
};
