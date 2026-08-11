import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export const Navbar = ({ activeRoute, onNavigate }) => {
    const { user, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    const handleNavClick = (route) => {
        onNavigate(route);
        closeMobileMenu();
    };

    const handleLogout = () => {
        logout();
        closeMobileMenu();
    };

    return (
        <header className="top-navbar-wrapper">
            {/* Main Top Header Bar */}
            <div className="top-navbar-main">
                <div className="brand-group" onClick={() => handleNavClick('home')}>
                    <div className="brand-logo-text">SigmaForce CEP</div>
                </div>

                <button
                    type="button"
                    className="nav-mobile-toggle"
                    aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    aria-expanded={isMobileMenuOpen}
                    onClick={() => setIsMobileMenuOpen((current) => !current)}
                >
                    <span className="nav-mobile-toggle-line" />
                    <span className="nav-mobile-toggle-line" />
                    <span className="nav-mobile-toggle-line" />
                </button>

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
                            <button className="btn-signout" onClick={handleLogout}>
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

            <div className={`mobile-menu-panel ${isMobileMenuOpen ? 'open' : ''}`}>
                {user ? (
                    <>
                        <div className="mobile-menu-user-card">
                            <div className="user-name-text">
                                {user.name}
                            </div>
                            <div className="user-role-tag">{user.role === 'admin' ? 'Admin' : `${user.remainingTests || 0} Tests`}</div>
                        </div>

                        <div className="mobile-menu-links">
                            {user.role === 'student' && (
                                <>
                                    <button
                                        className={`mobile-menu-link ${activeRoute === 'dashboard' ? 'active' : ''}`}
                                        onClick={() => handleNavClick('dashboard')}
                                    >
                                        Dashboard
                                    </button>
                                    <button
                                        className={`mobile-menu-link ${activeRoute === 'exams' ? 'active' : ''}`}
                                        onClick={() => handleNavClick('exams')}
                                    >
                                        Exam Catalog
                                    </button>
                                    <button
                                        className={`mobile-menu-link ${activeRoute === 'history' ? 'active' : ''}`}
                                        onClick={() => handleNavClick('history')}
                                    >
                                        Test History
                                    </button>
                                </>
                            )}

                            {user.role === 'admin' && (
                                <button
                                    className={`mobile-menu-link ${activeRoute === 'admin_dashboard' ? 'active' : ''}`}
                                    onClick={() => handleNavClick('admin_dashboard')}
                                >
                                    Admin Portal
                                </button>
                            )}
                        </div>

                        <button className="mobile-menu-signout" onClick={handleLogout}>
                            Sign Out
                        </button>
                    </>
                ) : (
                    <div className="mobile-menu-links mobile-menu-auth-actions">
                        <button
                            className="mobile-menu-link mobile-menu-auth-primary"
                            onClick={() => handleNavClick('login')}
                        >
                            Sign In
                        </button>
                        <button
                            className="mobile-menu-link mobile-menu-auth-secondary"
                            onClick={() => handleNavClick('signup')}
                        >
                            Get Started
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};
