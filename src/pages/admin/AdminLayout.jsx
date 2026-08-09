import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export const AdminLayout = ({ activeRoute, onNavigate, onLogout, children }) => {
    const { user } = useAuth();

    return (
        <div className="app-shell">
            {/* Fixed Sidebar */}
            <aside className="sidebar">
                <div>
                    <div className="sidebar-header">
                        <div className="brand-logo" style={{ background: '#ec4899' }}>⚙️</div>
                        <div>
                            <div className="brand-title">SigmaForce</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Admin Control Panel</div>
                        </div>
                    </div>

                    <nav className="sidebar-nav">
                        <button 
                            className={`nav-item ${activeRoute === 'dashboard' ? 'active' : ''}`}
                            onClick={() => onNavigate('dashboard')}
                        >
                            <span>📊</span> Overview Dashboard
                        </button>

                        <button 
                            className={`nav-item ${activeRoute === 'students' ? 'active' : ''}`}
                            onClick={() => onNavigate('students')}
                        >
                            <span>👥</span> Student Accounts & Limits
                        </button>

                        <button 
                            className={`nav-item ${activeRoute === 'questions' ? 'active' : ''}`}
                            onClick={() => onNavigate('questions')}
                        >
                            <span>📚</span> Question Bank & Bulk CSV
                        </button>

                        <button 
                            className={`nav-item ${activeRoute === 'exams' ? 'active' : ''}`}
                            onClick={() => onNavigate('exams')}
                        >
                            <span>🎯</span> Exam Blueprints
                        </button>

                        <button 
                            className={`nav-item ${activeRoute === 'reports' ? 'active' : ''}`}
                            onClick={() => onNavigate('reports')}
                        >
                            <span>📈</span> System Reports
                        </button>
                    </nav>
                </div>

                {/* Sidebar User Footer */}
                <div className="sidebar-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#fce7f3', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                            A
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                {user?.name || 'Administrator'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                System Admin
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge badge-purple">ADMIN ROLE</span>
                        <button 
                            onClick={onLogout}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="main-wrapper">
                <header className="top-header">
                    <div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>SigmaForce CEP Platform</span>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700 }}>
                            {activeRoute === 'dashboard' && 'System Overview Dashboard'}
                            {activeRoute === 'students' && 'Student Accounts & Access Limits'}
                            {activeRoute === 'questions' && 'Centralized Question Bank & CSV Upload'}
                            {activeRoute === 'exams' && 'Exam Blueprint Configurations'}
                            {activeRoute === 'reports' && 'Evaluated Mock Submission Logs'}
                        </h2>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span className="badge badge-danger">ADMIN MODE</span>
                    </div>
                </header>

                <main className="content-body">
                    {children}
                </main>
            </div>
        </div>
    );
};
