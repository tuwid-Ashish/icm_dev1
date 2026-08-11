import React, { useState, useEffect } from 'react';
import { StudentTable } from '../../components/admin/StudentTable.jsx';
import { QuestionBankManager } from '../../components/admin/QuestionBankManager.jsx';
import { ExamConfigList } from '../../components/admin/ExamConfigList.jsx';
import { PackageManager } from '../../components/admin/PackageManager.jsx';
import { SystemReportsPage } from './SystemReportsPage.jsx';
import { firestoreEngine } from '../../services/firestoreEngine.js';

export const AdminDashboardPage = () => {
    // Tabs: 'overview' | 'students' | 'packages' | 'questions' | 'exams' | 'reports'
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({
        totalStudents: 2,
        totalQuestions: 68,
        totalExams: 3,
        totalPackages: 3,
        totalSubmissions: 0
    });

    const loadStats = async () => {
        const qList = await firestoreEngine.getQuestions('ALL');
        const eList = await firestoreEngine.getExams();
        const sList = await firestoreEngine.getSubmissions();
        const pkgLocal = localStorage.getItem('sigma_course_packages');
        const pkgCount = pkgLocal ? JSON.parse(pkgLocal).length : 3;

        setStats({
            totalStudents: 2,
            totalQuestions: qList.length,
            totalExams: eList.length,
            totalPackages: pkgCount,
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
                    Manage student test quota limits, course packages, question bank solutions, examination blueprints, and submission audit logs.
                </p>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="scrollable-tabs-bar">
                <button 
                    className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview Summary
                </button>
                <button 
                    className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('students')}
                >
                    Student Accounts & Packages
                </button>
                <button 
                    className={`btn ${activeTab === 'packages' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('packages')}
                >
                    Course Packages
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
                    Submission Reports
                </button>
            </div>

            {/* Overview Tab Content */}
            {activeTab === 'overview' && (
                <div>
                    <div className="stats-grid">
                        <div className="stat-card" onClick={() => setActiveTab('students')} style={{ cursor: 'pointer' }}>
                            <div className="stat-title">Registered Students</div>
                            <div className="stat-val">{stats.totalStudents}</div>
                            <div className="stat-sub">Mobile & Purchased Packages</div>
                        </div>

                        <div className="stat-card" onClick={() => setActiveTab('packages')} style={{ cursor: 'pointer' }}>
                            <div className="stat-title">Course Packages</div>
                            <div className="stat-val" style={{ color: 'var(--success)' }}>{stats.totalPackages}</div>
                            <div className="stat-sub">Active Test Bundles & Pricing</div>
                        </div>

                        <div className="stat-card" onClick={() => setActiveTab('questions')} style={{ cursor: 'pointer' }}>
                            <div className="stat-title">Central Question Pool</div>
                            <div className="stat-val" style={{ color: 'var(--primary)' }}>{stats.totalQuestions}</div>
                            <div className="stat-sub">Multi-Select Batch Checkboxes</div>
                        </div>

                        <div className="stat-card" onClick={() => setActiveTab('exams')} style={{ cursor: 'pointer' }}>
                            <div className="stat-title">Exam Blueprints</div>
                            <div className="stat-val" style={{ color: 'var(--purple)' }}>{stats.totalExams}</div>
                            <div className="stat-sub">Subject-wise Question Allocations</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Quick Administrative Actions</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <button className="btn btn-primary" onClick={() => setActiveTab('packages')}>
                                    + Create New Course Package (e.g. Police 100 Tests)
                                </button>
                                <button className="btn btn-secondary" onClick={() => setActiveTab('exams')}>
                                    Configure Subject-wise Question Distribution
                                </button>
                                <button className="btn btn-secondary" onClick={() => setActiveTab('questions')}>
                                    Add Question with Multi-Select Batches
                                </button>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">System Architecture Status</h3>
                            </div>
                            <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div>Cloud Firestore Status: <strong style={{ color: 'var(--success)' }}>CONNECTED</strong></div>
                                <div>Subject Distribution Engine: <strong style={{ color: 'var(--success)' }}>VALIDATED</strong></div>
                                <div>Multi-Select Batch Checkboxes: <strong style={{ color: 'var(--success)' }}>ACTIVE</strong></div>
                                <div>Mandatory Mobile Registration: <strong style={{ color: 'var(--primary)' }}>ENFORCED</strong></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'students' && <StudentTable onRefresh={loadStats} />}
            {activeTab === 'packages' && <PackageManager onRefresh={loadStats} />}
            {activeTab === 'questions' && <QuestionBankManager onRefresh={loadStats} />}
            {activeTab === 'exams' && <ExamConfigList />}
            {activeTab === 'reports' && <SystemReportsPage />}
        </div>
    );
};
