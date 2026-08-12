import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ExamProvider, useExam } from './context/ExamContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';

import { Navbar } from './components/common/Navbar.jsx';
import { LandingPage } from './pages/LandingPage.jsx';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { SignupPage } from './pages/auth/SignupPage.jsx';

import { StudentDashboardPage } from './pages/student/StudentDashboardPage.jsx';
import { ExamCatalogPage } from './pages/student/ExamCatalogPage.jsx';
import { TestSimulatorPage } from './pages/student/TestSimulatorPage.jsx';
import { TestResultPage } from './pages/student/TestResultPage.jsx';
import { HistoryPage } from './pages/student/HistoryPage.jsx';

import { AdminLoginPage } from './pages/admin/AdminLoginPage.jsx';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.jsx';

import './styles/theme.css';
import './styles/components.css';

const MainAppContent = () => {
    const { user, logout } = useAuth();
    const { activeSession, activeResult, setActiveResult } = useExam();

    // Navigation state: 'home' | 'login' | 'signup' | 'dashboard' | 'exams' | 'history' | 'admin_login' | 'admin_dashboard'
    const [currentRoute, setCurrentRoute] = useState('home');

    // Handle URL path inspection for isolated /admin route
    useEffect(() => {
        const path = window.location.pathname.toLowerCase();
        if (path === '/admin' || path.startsWith('/admin')) {
            if (user && user.role === 'admin') {
                setCurrentRoute('admin_dashboard');
            } else {
                setCurrentRoute('admin_login');
            }
        }
    }, [user]);

    const handleNavigate = (route) => {
        // Guard admin dashboard
        if (route === 'admin_dashboard' && (!user || user.role !== 'admin')) {
            setCurrentRoute('admin_login');
            return;
        }
        // Guard student protected routes
        if ((route === 'dashboard' || route === 'exams' || route === 'history') && user && user.role === 'admin') {
            setCurrentRoute('admin_dashboard');
            return;
        }
        setCurrentRoute(route);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-body)' }}>
            <Navbar 
                activeRoute={currentRoute}
                onNavigate={handleNavigate}
            />

            <main style={{ flex: 1 }}>
                {/* Active CBT Test Session (Blocked for Admins) */}
                {activeSession && user?.role === 'student' ? (
                    <div className="container">
                        <TestSimulatorPage />
                    </div>
                ) : activeResult ? (
                    <div className="container">
                        <TestResultPage result={activeResult} onBack={() => setActiveResult(null)} />
                    </div>
                ) : (
                    <>
                        {currentRoute === 'home' && <LandingPage onNavigate={handleNavigate} />}
                        {currentRoute === 'login' && <LoginPage onSwitchToSignup={() => setCurrentRoute('signup')} onLoginSuccess={() => setCurrentRoute('dashboard')} />}
                        {currentRoute === 'signup' && <SignupPage onSwitchToLogin={() => setCurrentRoute('login')} onSignupSuccess={() => setCurrentRoute('dashboard')} />}
                        
                        {/* Student Dashboard (Requires Student Role) */}
                        {currentRoute === 'dashboard' && user && user.role === 'student' && (
                            <div className="container">
                                <StudentDashboardPage onNavigate={handleNavigate} />
                            </div>
                        )}

                        {/* Exam Catalog & Syllabus Explorer */}
                        {currentRoute === 'exams' && user && user.role === 'student' && (
                            <div className="container">
                                <ExamCatalogPage />
                            </div>
                        )}

                        {/* Test History & Subject Analytics */}
                        {currentRoute === 'history' && user && user.role === 'student' && (
                            <div className="container">
                                <HistoryPage onViewResult={setActiveResult} />
                            </div>
                        )}

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
                    </>
                )}
            </main>
        </div>
    );
};

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <LanguageProvider>
                    <ExamProvider>
                        <MainAppContent />
                    </ExamProvider>
                </LanguageProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
