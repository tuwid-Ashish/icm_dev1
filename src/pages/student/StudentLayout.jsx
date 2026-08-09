import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useExam } from '../../context/ExamContext.jsx';

export const StudentLayout = ({ activeRoute, onNavigate, onLogout, children }) => {
    const { user } = useAuth();
    const { activeSession } = useExam();

    // If taking an active CBT test, render full-screen CBT simulator without sidebar
    if (activeSession) {
        return children;
    }

    return (
        <div className="app-shell">
            {/* Fixed Sidebar */}
            <aside className="sidebar">
                <div>
                    <div className="sidebar-header">
                        <div className="brand-logo">⚡</div>
                        <div>
                            <div className="brand-title">SigmaForce</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Student Practice Portal</div>
                        </div>
                    </div>

                    <nav className="sidebar-nav">
                        <button 
                            className={`nav-item ${activeRoute === 'dashboard' ? 'active' : ''}`}
                            onClick={() => onNavigate('dashboard')}
                        >
                            <span>🏠</span> Dashboard
                        </button>

                        <button 
                            className={`nav-item ${activeRoute === 'exams' ? 'active' : ''}`}
                            onClick={() => onNavigate('exams')}
                        >
                            <span>🎯</span> Exam Catalog
                        </button>

                        <button 
                            className={`nav-item ${activeRoute === 'history' ? 'active' : ''}`}
                            onClick={() => onNavigate('history')}
                        >
                            <span>📜</span> Test History
                        </button>

                        <button 
                            className={`nav-item ${activeRoute === 'analytics' ? 'active' : ''}`}
                            onClick={() => onNavigate('analytics')}
                        >
                            <span>📊</span> Performance Analytics
                        </button>
                    </nav>
                </div>

                {/* Sidebar User Footer */}
                <div className="sidebar-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                            {user?.name ? user.name[0] : 'S'}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {user?.enrollmentId || 'SIGMA-2026'}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={`badge ${user?.remainingTests > 0 ? 'badge-success' : 'badge-danger'}`}>
                            🎟️ {user?.remainingTests || 0} Tests Left
                        </span>
                        <button 
                            onClick={onLogout}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Wrapper */}
            <div className="main-wrapper">
                <header className="top-header">
                    <div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>SigmaForce CEP Platform</span>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700 }}>
                            {activeRoute === 'dashboard' && 'Dashboard Overview'}
                            {activeRoute === 'exams' && 'Target Exam Blueprints'}
                            {activeRoute === 'history' && 'Completed Practice Mocks'}
                            {activeRoute === 'analytics' && 'Strength & Accuracy Analytics'}
                        </h2>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span className="badge badge-purple">Role: STUDENT</span>
                    </div>
                </header>

                <main className="content-body">
                    {children}
                </main>
            </div>
        </div>
    );
};
