import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ExamProvider, useExam } from './context/ExamContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';

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
        setCurrentRoute(route);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-body)' }}>
            <Navbar 
                activeRoute={currentRoute}
                onNavigate={handleNavigate}
            />

            <main style={{ flex: 1 }}>
                {/* Active CBT Test Session */}
                {activeSession ? (
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
                        
                        {/* Student Dashboard */}
                        {currentRoute === 'dashboard' && (
                            <div className="container">
                                <StudentDashboardPage onNavigate={handleNavigate} />
                            </div>
                        )}

                        {/* Exam Catalog & Syllabus Explorer */}
                        {currentRoute === 'exams' && (
                            <div className="container">
                                <ExamCatalogPage />
                            </div>
                        )}

                        {/* Test History & Subject Analytics */}
                        {currentRoute === 'history' && (
                            <div className="container">
                                <HistoryPage onViewResult={setActiveResult} />
                            </div>
                        )}

                        {/* Isolated Admin Login */}
                        {currentRoute === 'admin_login' && (
                            <AdminLoginPage onAdminLoginSuccess={() => setCurrentRoute('admin_dashboard')} />
                        )}

                        {/* Admin Portal Dashboard */}
                        {currentRoute === 'admin_dashboard' && (
                            <div className="container">
                                <AdminDashboardPage onNavigate={handleNavigate} />
                            </div>
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
                <ExamProvider>
                    <MainAppContent />
                </ExamProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
