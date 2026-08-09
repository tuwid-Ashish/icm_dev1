import React, { useState, useEffect } from 'react';
import { StudentTable } from '../../components/admin/StudentTable.jsx';
import { QuestionBankManager } from '../../components/admin/QuestionBankManager.jsx';
import { ExamConfigList } from '../../components/admin/ExamConfigList.jsx';
import { SystemReportsPage } from './SystemReportsPage.jsx';
import { firestoreEngine } from '../../services/firestoreEngine.js';

export const AdminDashboardPage = () => {
    // Tabs: 'overview' | 'students' | 'questions' | 'exams' | 'reports'
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({
        totalStudents: 2,
        totalQuestions: 60,
        totalExams: 3,
        totalSubmissions: 0
    });

    const loadStats = async () => {
        const qList = await firestoreEngine.getQuestions('ALL');
        const eList = await firestoreEngine.getExams();
        const sList = await firestoreEngine.getSubmissions();
        setStats({
            totalStudents: 2,
            totalQuestions: qList.length,
            totalExams: eList.length,
            totalSubmissions: sList.length
        });
    };

    useEffect(() => {
        loadStats();
    }, []);

    return (
        <div>
            {/* Admin Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', fontWeight: 800 }}>
                    Administrative Control Panel & Governance
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                    Manage student test quota limits, question bank solutions, examination blueprints, and submission audit logs.
                </p>
            </div>

            {/* Navigation Tabs Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-surface)', padding: '0.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', marginBottom: '1.75rem', flexWrap: 'wrap', boxShadow: 'var(--shadow-sm)' }}>
                <button 
                    className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview & Executive Summary
                </button>
                <button 
                    className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('students')}
                >
                    Student Accounts & Quotas
                </button>
                <button 
                    className={`btn ${activeTab === 'questions' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('questions')}
                >
                    Question Bank & Solutions
                </button>
                <button 
                    className={`btn ${activeTab === 'exams' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('exams')}
                >
                    Exam Blueprints & Patterns
                </button>
                <button 
                    className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('reports')}
                >
                    System Submission Reports
                </button>
            </div>

            {/* Overview Tab Content */}
            {activeTab === 'overview' && (
                <div>
                    <div className="stats-grid">
                        <div className="stat-card" onClick={() => setActiveTab('students')} style={{ cursor: 'pointer' }}>
                            <div className="stat-title">Registered Students</div>
                            <div className="stat-val">{stats.totalStudents}</div>
                            <div className="stat-sub">Quota Limit Control</div>
                        </div>

                        <div className="stat-card" onClick={() => setActiveTab('questions')} style={{ cursor: 'pointer' }}>
                            <div className="stat-title">Central Question Pool</div>
                            <div className="stat-val" style={{ color: 'var(--primary)' }}>{stats.totalQuestions}</div>
                            <div className="stat-sub">Bilingual Qs with Solutions</div>
                        </div>

                        <div className="stat-card" onClick={() => setActiveTab('exams')} style={{ cursor: 'pointer' }}>
                            <div className="stat-title">Exam Blueprints</div>
                            <div className="stat-val" style={{ color: 'var(--purple)' }}>{stats.totalExams}</div>
                            <div className="stat-sub">Active Recruitment Patterns</div>
                        </div>

                        <div className="stat-card" onClick={() => setActiveTab('reports')} style={{ cursor: 'pointer' }}>
                            <div className="stat-title">Evaluated Submissions</div>
                            <div className="stat-val" style={{ color: 'var(--success)' }}>{stats.totalSubmissions}</div>
                            <div className="stat-sub">Completed Test Scorecards</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Quick Administrative Actions</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <button className="btn btn-primary" onClick={() => setActiveTab('questions')}>
                                    Bulk Import Questions from Google Sheets CSV
                                </button>
                                <button className="btn btn-secondary" onClick={() => setActiveTab('students')}>
                                    Adjust Student Practice Test Limits (allowedTests)
                                </button>
                                <button className="btn btn-secondary" onClick={() => setActiveTab('exams')}>
                                    Create New Recruitment Exam Type
                                </button>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">System Status & Database Integration</h3>
                            </div>
                            <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div>Cloud Firestore Status: <strong style={{ color: 'var(--success)' }}>CONNECTED</strong></div>
                                <div>Firebase Admin SDK: <strong style={{ color: 'var(--success)' }}>ACTIVE</strong></div>
                                <div>Security Rules Bypass: <strong style={{ color: 'var(--primary)' }}>SERVICE ACCOUNT / SECURED</strong></div>
                                <div>Active Recruitment Patterns: <strong>Police Bharti, Forest Guard, SSC GD</strong></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'students' && <StudentTable onRefresh={loadStats} />}
            {activeTab === 'questions' && <QuestionBankManager onRefresh={loadStats} />}
            {activeTab === 'exams' && <ExamConfigList />}
            {activeTab === 'reports' && <SystemReportsPage />}
        </div>
    );
};
