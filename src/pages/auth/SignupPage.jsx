import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export const SignupPage = ({ onSwitchToLogin, onSignupSuccess }) => {
    const { signup } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!mobile.trim() || mobile.trim().length < 10) {
            setErrorMessage('Mobile Number is mandatory (minimum 10 digits).');
            return;
        }

        setLoading(true);
        setErrorMessage('');

        const res = await signup(name, email, password, mobile);
        setLoading(false);

        if (res.success) {
            onSignupSuccess(res.user);
        } else {
            setErrorMessage(res.message || 'Registration failed.');
        }
    };

    return (
        <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)', padding: '1.5rem 1rem' }}>
            <div className="auth-card">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.5px', marginBottom: '0.35rem' }}>
                        Student Registration
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Create Account
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                        Register to access recruitment mock test packages
                    </p>
                </div>

                {errorMessage && (
                    <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                        {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Full Name *</label>
                        <input 
                            type="text" 
                            className="form-control" 
                            required 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Rahul Patil"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Mobile Number * (Mandatory - 10 Digits)</label>
                        <input 
                            type="tel" 
                            className="form-control" 
                            required 
                            maxLength={10}
                            pattern="[0-9]{10}"
                            value={mobile}
                            onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="9876543210"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Email Address *</label>
                        <input 
                            type="email" 
                            className="form-control" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="rahul@example.com"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password *</label>
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
                        {loading ? 'Creating Student Account...' : 'Register Student Account'}
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Already registered?{' '}
                    <button 
                        onClick={onSwitchToLogin}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        Sign In Now
                    </button>
                </div>
            </div>
        </div>
    );
};
