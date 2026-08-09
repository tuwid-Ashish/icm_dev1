import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Flame, User, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';

export const SignupPage = ({ onSwitchToLogin, onSignupSuccess }) => {
    const { signup } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMessage('');

        const res = await signup(name, email, password);
        setLoading(false);

        if (res.success) {
            onSignupSuccess(res.user);
        } else {
            setErrorMessage(res.message || 'Registration failed.');
        }
    };

    return (
        <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)', padding: '2rem 1.5rem' }}>
            <div style={{ width: '100%', maxWidth: '460px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: '2.5rem', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: '48px', height: '48px', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius-md)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)' }}>
                        <Flame size={24} />
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>Student Registration</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Create your account to start practice test papers</p>
                </div>

                {errorMessage && (
                    <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={16} /> {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <div style={{ position: 'relative' }}>
                            <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input 
                                type="text" 
                                className="form-control" 
                                style={{ paddingLeft: '2.5rem' }}
                                required 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Student Full Name"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input 
                                type="email" 
                                className="form-control" 
                                style={{ paddingLeft: '2.5rem' }}
                                required 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@sigma.com"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input 
                                type="password" 
                                className="form-control" 
                                style={{ paddingLeft: '2.5rem' }}
                                required 
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 6 characters"
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
                        {loading ? 'Registering Account...' : <>Register Account <ArrowRight size={18} /></>}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Already have an account?{' '}
                    <button onClick={onSwitchToLogin} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}>
                        Sign In Instead
                    </button>
                </div>
            </div>
        </div>
    );
};
