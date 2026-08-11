import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export const Navbar = ({ activeRoute, onNavigate }) => {
    const { user, logout } = useAuth();

    const handleNavClick = (route) => {
        onNavigate(route);
    };

    return (
        <header className="top-navbar-wrapper">
            {/* Main Top Header Bar */}
            <div className="top-navbar-main">
                <div className="brand-group" onClick={() => handleNavClick('home')}>
                    <div className="brand-logo-text">SigmaForce CEP</div>
                </div>

                {/* Desktop Navigation Links */}
                {user && (
                    <nav className="nav-links-desktop">
                        {user.role === 'student' && (
                            <>
                                <button 
                                    className={`nav-link ${activeRoute === 'dashboard' ? 'active' : ''}`}
                                    onClick={() => handleNavClick('dashboard')}
                                >
                                    Student Dashboard
                                </button>
                                <button 
                                    className={`nav-link ${activeRoute === 'exams' ? 'active' : ''}`}
                                    onClick={() => handleNavClick('exams')}
                                >
                                    Exam Catalog
                                </button>
                                <button 
                                    className={`nav-link ${activeRoute === 'history' ? 'active' : ''}`}
                                    onClick={() => handleNavClick('history')}
                                >
                                    Test History
                                </button>
                            </>
                        )}

                        {user.role === 'admin' && (
                            <button 
                                className={`nav-link ${activeRoute === 'admin_dashboard' ? 'active' : ''}`}
                                onClick={() => handleNavClick('admin_dashboard')}
                            >
                                Admin Portal
                            </button>
                        )}
                    </nav>
                )}

                {/* Right User Display & Actions */}
                <div className="nav-user-actions">
                    {user ? (
                        <div className="user-profile-badge">
                            <span className="user-name-text">
                                {user.name} <span className="user-role-tag">({user.role === 'admin' ? 'Admin' : `${user.remainingTests || 0} Tests`})</span>
                            </span>
                            <button className="btn-signout" onClick={logout}>
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                                className="btn btn-sm" 
                                style={{ background: '#0f172a', color: '#ffffff', fontWeight: 700 }}
                                onClick={() => handleNavClick('login')}
                            >
                                Sign In
                            </button>
                            <button 
                                className="btn btn-sm" 
                                style={{ background: '#ffffff', color: '#ea580c', fontWeight: 800 }}
                                onClick={() => handleNavClick('signup')}
                            >
                                Get Started
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Sub-Navigation Strip (Only for Logged-In Users) */}
            {user && (
                <div className="mobile-subnav-bar">
                    {user.role === 'student' && (
                        <>
                            <button 
                                className={`subnav-link ${activeRoute === 'dashboard' ? 'active' : ''}`}
                                onClick={() => handleNavClick('dashboard')}
                            >
                                Dashboard
                            </button>
                            <button 
                                className={`subnav-link ${activeRoute === 'exams' ? 'active' : ''}`}
                                onClick={() => handleNavClick('exams')}
                            >
                                Exam Catalog
                            </button>
                            <button 
                                className={`subnav-link ${activeRoute === 'history' ? 'active' : ''}`}
                                onClick={() => handleNavClick('history')}
                            >
                                Test History
                            </button>
                        </>
                    )}

                    {user.role === 'admin' && (
                        <button 
                            className={`subnav-link ${activeRoute === 'admin_dashboard' ? 'active' : ''}`}
                            onClick={() => handleNavClick('admin_dashboard')}
                        >
                            Admin Portal
                        </button>
                    )}
                </div>
            )}
        </header>
    );
};
