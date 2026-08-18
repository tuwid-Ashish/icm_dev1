import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext.jsx';
import { useExam } from '../context/ExamContext.jsx';
import { Navbar } from '../components/common/Navbar.jsx';
import { TestSimulatorPage } from '../pages/student/TestSimulatorPage.jsx';
import { TestResultPage } from '../pages/student/TestResultPage.jsx';

// Shared shell for every real /dashboard/* route: auth guard (student-only),
// the shared Navbar wired to router.push instead of internal state, and the
// active-test-session / just-finished-result override — a student mid-test
// or looking at a fresh scorecard sees that regardless of which dashboard
// page they were on, exactly like the old single-page-app behaved.
const routeForPath = (pathname) => {
    if (pathname.startsWith('/dashboard/exams')) return 'exams';
    if (pathname.startsWith('/dashboard/history')) return 'history';
    return 'dashboard';
};

export const DashboardShell = ({ children }) => {
    const router = useRouter();
    const { user, authLoading } = useAuth();
    const { activeSession, activeResult, setActiveResult } = useExam();

    useEffect(() => {
        if (authLoading) return;
        if (!user) { router.replace('/'); return; }
        if (user.role !== 'student') { router.replace('/admin'); return; }
    }, [authLoading, user, router]);

    const handleNavigate = (route) => {
        switch (route) {
            case 'home': router.push('/'); break;
            case 'dashboard': router.push('/dashboard'); break;
            case 'exams': router.push('/dashboard/exams'); break;
            case 'history': router.push('/dashboard/history'); break;
            case 'admin_dashboard': router.push('/admin'); break;
            default: break;
        }
    };

    const ready = !authLoading && user && user.role === 'student';
    // Hidden on the hub itself (nothing to go "back" to), and during an
    // active test / fresh result — a test in progress shouldn't offer an
    // easy way to navigate away mid-attempt, and the result screen already
    // has its own "Back to Dashboard" action.
    const showBackButton = ready && router.pathname !== '/dashboard' && !activeSession && !activeResult;

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-body)' }}>
            <Navbar activeRoute={routeForPath(router.pathname)} onNavigate={handleNavigate} />

            <main style={{ flex: 1, minWidth: 0 }}>
                {!ready ? null : (
                    <div className="container">
                        {showBackButton && (
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ marginBottom: '1.25rem' }}
                                onClick={() => router.push('/dashboard')}
                            >
                                ← Back to Dashboard
                            </button>
                        )}
                        {activeSession ? (
                            <TestSimulatorPage />
                        ) : activeResult ? (
                            <TestResultPage result={activeResult} onBack={() => setActiveResult(null)} />
                        ) : children}
                    </div>
                )}
            </main>
        </div>
    );
};
