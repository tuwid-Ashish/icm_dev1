import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export const Navbar = ({ activeRoute, onNavigate }) => {
    const { user, logout } = useAuth();

    return (
        <header className="top-navbar">
            <div className="brand-group" onClick={() => onNavigate('home')}>
                <div className="brand-logo-text">SigmaForce CEP</div>
            </div>

            {/* Navigation Links - Only displayed for authenticated users */}
            {user && (
                <nav className="nav-links">
                    {user.role === 'student' && (
                        <>
                            <button 
                                className={`nav-link ${activeRoute === 'dashboard' ? 'active' : ''}`}
                                onClick={() => onNavigate('dashboard')}
                            >
                                Student Dashboard
                            </button>
                            <button 
                                className={`nav-link ${activeRoute === 'exams' ? 'active' : ''}`}
                                onClick={() => onNavigate('exams')}
                            >
                                Exam Catalog
                            </button>
                            <button 
                                className={`nav-link ${activeRoute === 'history' ? 'active' : ''}`}
                                onClick={() => onNavigate('history')}
                            >
                                Test History
                            </button>
                        </>
                    )}

                    {user.role === 'admin' && (
                        <>
                            <button 
                                className={`nav-link ${activeRoute === 'admin_dashboard' ? 'active' : ''}`}
                                onClick={() => onNavigate('admin_dashboard')}
                            >
                                Admin Portal
                            </button>
                        </>
                    )}
                </nav>
            )}

            {/* Right User Display & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                {user ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.9rem' }}>
                            {user.name} • {user.role === 'admin' ? 'Administrator' : `${user.remainingTests} Tests Left`}
                        </div>
                        <button className="btn-signout" onClick={logout}>
                            Sign Out
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button 
                            className="btn" 
                            style={{ background: '#0f172a', color: '#ffffff', fontWeight: 700 }}
                            onClick={() => onNavigate('login')}
                        >
                            Sign In
                        </button>
                        <button 
                            className="btn" 
                            style={{ background: '#ffffff', color: '#ea580c', fontWeight: 800 }}
                            onClick={() => onNavigate('signup')}
                        >
                            Get Started
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};
