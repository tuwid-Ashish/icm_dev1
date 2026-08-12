import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const LoginPage = ({ onSwitchToSignup, onLoginSuccess }) => {
    const { login } = useAuth();
    const { t } = useLanguage();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMessage('');

        const res = await login(email, password, 'student');
        setLoading(false);

        if (res.success) {
            onLoginSuccess(res.user);
        } else {
            setErrorMessage(res.message || 'Invalid email or password.');
        }
    };

    return (
        <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)', padding: '1.5rem 1rem' }}>
            <div className="auth-card">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.5px', marginBottom: '0.35rem' }}>
                        {t('portal_auth_tag')}
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t('student_signin_title')}</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{t('student_signin_desc')}</p>
                </div>

                {errorMessage && (
                    <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                        {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">{t('email_address_label')}</label>
                        <input 
                            type="email" 
                            className="form-control" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t('email_placeholder')}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">{t('password_label')}</label>
                        <input 
                            type="password" 
                            className="form-control" 
                            required 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t('password_placeholder')}
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary" 
                        disabled={loading}
                        style={{ width: '100%', marginTop: '0.5rem', padding: '0.85rem', fontSize: '1rem', fontWeight: 800 }}
                    >
                        {loading ? t('signing_in_btn') : t('signin_portal_btn')}
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {t('dont_have_account')}{' '}
                    <button 
                        onClick={onSwitchToSignup}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        {t('register_now')}
                    </button>
                </div>
            </div>
        </div>
    );
};
