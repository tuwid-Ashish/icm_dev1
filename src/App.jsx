import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './context/AuthContext.jsx';
import { storageService } from './services/storageService.js';

import { Navbar } from './components/common/Navbar.jsx';
import { LandingPage } from './pages/LandingPage.jsx';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { SignupPage } from './pages/auth/SignupPage.jsx';

import { AdminLoginPage } from './pages/admin/AdminLoginPage.jsx';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.jsx';

// Global CSS (theme.css, components.css) is imported once in pages/_app.js —
// Next.js only allows global stylesheet imports from the custom App.
// Context providers also live in pages/_app.js now (src/context/AppProviders.jsx)
// so they persist across Next.js page navigations instead of remounting on
// every route change — this component only consumes them.

// Everything under the student dashboard (/dashboard, /dashboard/history,
// /dashboard/exams, etc.) is a real Next.js route now (see pages/dashboard/*),
// each wrapped in its own src/layouts/DashboardShell.jsx — this component no
// longer renders those directly. It still owns: the public landing page,
// student login/signup, and the admin portal (none of which needed splitting
// into dedicated pages).
const MainAppContent = () => {
    const router = useRouter();
    const { user } = useAuth();

    // Navigation state: 'home' | 'login' | 'signup' | 'admin_login' | 'admin_dashboard'
    const [currentRoute, setCurrentRoute] = useState('home');
    // Gates rendering until we've decided whether an already-authenticated
    // visitor to '/' should be bounced to their real dashboard/admin route,
    // so they don't see a flash of the landing page first.
    const [routeReady, setRouteReady] = useState(false);

    useEffect(() => {
        const path = window.location.pathname.toLowerCase();

        if (path === '/admin' || path.startsWith('/admin')) {
            setCurrentRoute(user && user.role === 'admin' ? 'admin_dashboard' : 'admin_login');
            setRouteReady(true);
            return;
        }

        // Landing on '/' — an already-authenticated student/admin belongs on
        // their real dashboard route, not the logged-out marketing page.
        const cached = storageService.getCurrentUser();
        if (cached?.role === 'student') {
            router.replace('/dashboard');
            return;
        }
        if (cached?.role === 'admin') {
            router.replace('/admin');
            return;
        }
        setCurrentRoute('home');
        setRouteReady(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const handleNavigate = (route) => {
        if (route === 'dashboard' || route === 'exams' || route === 'history') {
            if (user && user.role === 'admin') {
                setCurrentRoute('admin_dashboard');
                return;
            }
            router.push(route === 'dashboard' ? '/dashboard' : `/dashboard/${route}`);
            return;
        }
        if (route === 'admin_dashboard' && (!user || user.role !== 'admin')) {
            setCurrentRoute('admin_login');
            return;
        }
        setCurrentRoute(route);
    };

    if (!routeReady) return null;

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-body)' }}>
            <Navbar
                activeRoute={currentRoute}
                onNavigate={handleNavigate}
            />

            {/* min-width: 0 overrides the flex item default of min-width: auto —
                without it, a wide child makes this flex item grow to fit its
                content's min-content width instead of constraining it, pushing
                the whole page into horizontal overflow instead of wrapping. */}
            <main style={{ flex: 1, minWidth: 0 }}>
                {currentRoute === 'home' && <LandingPage onNavigate={handleNavigate} />}
                {currentRoute === 'login' && <LoginPage onSwitchToSignup={() => setCurrentRoute('signup')} onLoginSuccess={() => router.push('/dashboard')} />}
                {currentRoute === 'signup' && <SignupPage onSwitchToLogin={() => setCurrentRoute('login')} onSignupSuccess={() => router.push('/dashboard')} />}

                {/* Isolated Admin Login */}
                {currentRoute === 'admin_login' && (
                    user && user.role === 'admin' ? (
                        <div className="container">
                            <AdminDashboardPage onNavigate={handleNavigate} />
                        </div>
                    ) : (
                        <AdminLoginPage onAdminLoginSuccess={() => setCurrentRoute('admin_dashboard')} />
                    )
                )}

                {/* Admin Portal Dashboard (Protected Admin Route) */}
                {currentRoute === 'admin_dashboard' && (
                    user && user.role === 'admin' ? (
                        <div className="container">
                            <AdminDashboardPage onNavigate={handleNavigate} />
                        </div>
                    ) : (
                        <AdminLoginPage onAdminLoginSuccess={() => setCurrentRoute('admin_dashboard')} />
                    )
                )}
            </main>
        </div>
    );
};

export default function App() {
    return <MainAppContent />;
}
