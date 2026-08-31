import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Modal } from './Modal.jsx';

export const AuthModal = ({ isOpen, onClose }) => {
    const { login } = useAuth();
    const [role, setRole] = useState('student');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSelectRole = (r) => {
        setRole(r);
        setEmail('');
        setPassword('');
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

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Switch Account / Login"
            maxWidth="450px"
            onSubmit={handleSubmit}
            footer={
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Sign In As {role.toUpperCase()}
                </button>
            }
        >
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: 'var(--bg-subtle)', padding: '0.35rem', borderRadius: 'var(--radius-md)' }}>
                <button 
                    type="button"
                    className={`btn ${role === 'student' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => handleSelectRole('student')}
                >
                    Student
                </button>
                <button 
                    type="button"
                    className={`btn ${role === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => handleSelectRole('admin')}
                >
                    Admin
                </button>
            </div>

            <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                    type="email" 
                    className="form-control" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
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
        </Modal>
    );
};
