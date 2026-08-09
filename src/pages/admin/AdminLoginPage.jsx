import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export const AdminLoginPage = ({ onAdminLoginSuccess }) => {
    const { login } = useAuth();
    const [email, setEmail] = useState('admin@sigma.com');
    const [password, setPassword] = useState('admin123');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMessage('');

        try {
            const res = await login(email, password, 'admin');
            setLoading(false);

            if (res.success) {
                onAdminLoginSuccess(res.user);
            } else {
                setErrorMessage(res.message || 'Invalid admin credentials.');
            }
        } catch (err) {
            setLoading(false);
            setErrorMessage('Authentication error: ' + err.message);
        }
    };

    return (
        <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)', padding: '2rem 1.5rem' }}>
            <div style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: '2.5rem', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.5px', marginBottom: '0.35rem' }}>
                        Restricted Access
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        System Admin Portal
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        Restricted authentication for system administrators
                    </p>
                </div>

                {errorMessage && (
                    <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                        {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Admin Email</label>
                        <input 
                            type="email" 
                            className="form-control" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@sigma.com"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input 
                            type="password" 
                            className="form-control" 
                            required 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary" 
                        disabled={loading}
                        style={{ width: '100%', marginTop: '0.5rem', padding: '0.85rem', fontSize: '1rem', fontWeight: 800 }}
                    >
                        {loading ? 'Authenticating Admin...' : 'Authenticate Admin'}
                    </button>
                </form>

                <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Admin Credentials: <code>admin@sigma.com</code> / <code>admin123</code>
                </div>
            </div>
        </div>
    );
};
