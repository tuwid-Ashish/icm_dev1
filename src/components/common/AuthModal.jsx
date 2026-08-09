import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export const AuthModal = ({ isOpen, onClose }) => {
    const { login } = useAuth();
    const [role, setRole] = useState('student');
    const [email, setEmail] = useState('student@sigma.com');
    const [password, setPassword] = useState('pass123');

    if (!isOpen) return null;

    const handleSelectRole = (r) => {
        setRole(r);
        if (r === 'admin') {
            setEmail('admin@sigma.com');
            setPassword('admin123');
        } else {
            setEmail('student@sigma.com');
            setPassword('pass123');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const res = login(email, password, role);
        if (res.success) {
            onClose();
        } else {
            alert(res.message || 'Login failed.');
        }
    };

    return (
        <div class="modal-overlay">
            <div class="modal-content" style={{ maxWidth: '450px' }}>
                <div class="modal-header">
                    <h3 class="panel-title">🔐 Switch Account / Login</h3>
                    <button class="modal-close" onClick={onClose}>&times;</button>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--bg-tertiary)', padding: '0.35rem', borderRadius: 'var(--radius-md)' }}>
                    <button 
                        type="button"
                        class={`btn ${role === 'student' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1 }}
                        onClick={() => handleSelectRole('student')}
                    >
                        Student
                    </button>
                    <button 
                        type="button"
                        class={`btn ${role === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1 }}
                        onClick={() => handleSelectRole('admin')}
                    >
                        Admin
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div class="form-group">
                        <label class="form-label">Email Address</label>
                        <input 
                            type="email" 
                            class="form-control" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input 
                            type="password" 
                            class="form-control" 
                            required 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                        💡 <strong>Default Demo Accounts:</strong><br />
                        • Active Student: <code>student@sigma.com</code> / <code>pass123</code> (12 tests left)<br />
                        • Exhausted Limit: <code>rahul@sigma.com</code> / <code>pass123</code> (0 left)<br />
                        • Admin: <code>admin@sigma.com</code> / <code>admin123</code>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" class="btn btn-gradient" style={{ width: '100%' }}>
                            Sign In As {role.toUpperCase()}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
