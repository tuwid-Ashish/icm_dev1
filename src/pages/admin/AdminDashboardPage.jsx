import React, { useState, useEffect } from 'react';
import { StudentTable } from '../../components/admin/StudentTable.jsx';
import { QuestionBankManager } from '../../components/admin/QuestionBankManager.jsx';
import { SubjectCodeManager } from '../../components/admin/SubjectCodeManager.jsx';
import { ExamConfigList } from '../../components/admin/ExamConfigList.jsx';
import { FreeTestManager } from '../../components/admin/FreeTestManager.jsx';
import { PackageManager } from '../../components/admin/PackageManager.jsx';
import { SystemReportsPage } from './SystemReportsPage.jsx';
import { ExamPaperGenerator } from '../../components/admin/ExamPaperGenerator.jsx';
import { PaymentsPanel } from '../../components/admin/PaymentsPanel.jsx';
import { ReportedQuestionsPanel } from '../../components/admin/ReportedQuestionsPanel.jsx';
import { UsageMeter, UsageBanner } from '../../components/admin/UsagePanel.jsx';
import { SubjectWiseCountWidget } from '../../components/admin/SubjectWiseCountWidget.jsx';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const AdminDashboardPage = () => {
    const { t } = useLanguage();
    // Tabs: 'overview' | 'students' | 'packages' | 'payments' | 'questions' | 'subject_codes' | 'exams' | 'free_tests' | 'reports' | 'exam_paper'
    const [activeTab, setActiveTab] = useState('overview');
    // Per-subject question totals from the question index — the Overview no
    // longer loads the questions themselves just to count them.
    const [questionCounts, setQuestionCounts] = useState({});
    const [questionsIndexed, setQuestionsIndexed] = useState(false);
    // Open reports from students, shown on the tab; and the question the Reported
    // tab has asked the Question Bank to open for editing.
    const [openReports, setOpenReports] = useState(0);
    const [focusQuestionId, setFocusQuestionId] = useState(null);
    const [subjectCodes, setSubjectCodes] = useState([]);
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalQuestions: 0,
        totalExams: 0,
        totalPackages: 0,
        totalSubmissions: 0,
        totalSubjects: 0
    });

    const loadStats = async () => {
        const [qStats, eList, attemptCount, pkgList, studentCount, subList, reportCount] = await Promise.all([
            firestoreEngine.getQuestionStats(),
            firestoreEngine.getExams(),
            firestoreEngine.countAttempts(),
            firestoreEngine.getPackages(),
            firestoreEngine.countStudents(),
            firestoreEngine.getSubjectCodes(),
            firestoreEngine.countOpenQuestionReports()
        ]);

        setOpenReports(reportCount);
        setQuestionCounts(qStats.counts || {});
        setQuestionsIndexed(qStats.source === 'index');
        setSubjectCodes(subList || []);
        setStats({
            totalStudents: studentCount,
            totalQuestions: qStats.total,
            totalExams: (eList || []).length,
            totalPackages: (pkgList || []).length,
            totalSubmissions: attemptCount,
            totalSubjects: (subList || []).length
        });
    };

    useEffect(() => {
        loadStats();
    }, []);


    return (
        <div>
            {/* Admin Header */}
            <div className="no-print" style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', fontWeight: 800 }}>
                    {t('admin_panel_title')}
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                    {t('admin_panel_desc')}
                </p>
            </div>

            {/* Appears on any screen the moment Firebase's daily free limit is used up */}
            <UsageBanner />

            {/* Navigation Tabs Bar */}
            <div className="scrollable-tabs-bar no-print">
                <button 
                    className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('overview')}
                >
                    {t('tab_overview')}
                </button>
                <button 
                    className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('students')}
                >
                    {t('tab_students')}
                </button>
                <button 
                    className={`btn ${activeTab === 'packages' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('packages')}
                >
                    {t('tab_packages')}
                </button>
                <button 
                    className={`btn ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('payments')}
                >
                    {t('tab_payments')}
                </button>
                <button
                    className={`btn ${activeTab === 'reported' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('reported')}
                >
                    {t('tab_reported')}{openReports > 0 ? ` (${openReports})` : ''}
                </button>
                <button 
                    className={`btn ${activeTab === 'questions' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('questions')}
                >
                    {t('tab_questions')}
                </button>
                <button 
                    className={`btn ${activeTab === 'subject_codes' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('subject_codes')}
                >
                    {t('tab_subject_codes')}
                </button>
                <button
                    className={`btn ${activeTab === 'exams' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('exams')}
                >
                    {t('tab_exams')}
                </button>
                <button
                    className={`btn ${activeTab === 'free_tests' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('free_tests')}
                >
                    {t('tab_free_tests')}
                </button>
                <button
                    className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('reports')}
                >
                    {t('tab_reports')}
                </button>
                <button
                    className={`btn ${activeTab === 'exam_paper' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('exam_paper')}
                >
                    {t('tab_exam_paper')}
                </button>
            </div>

            {/* Overview Tab Content */}
            {activeTab === 'overview' && (
                <div>
                    <UsageMeter questionCount={stats.totalQuestions} indexed={questionsIndexed} />

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

                        <div className="stat-card" onClick={() => setActiveTab('reported')} style={{ cursor: 'pointer' }}>
                            <div className="stat-title">Reported Questions</div>
                            <div className="stat-val" style={{ color: openReports > 0 ? 'var(--danger)' : 'var(--success)' }}>{openReports}</div>
                            <div className="stat-sub">{openReports > 0 ? 'Flagged by students — need a look' : 'Nothing flagged right now'}</div>
                        </div>

                        <div className="stat-card" onClick={() => setActiveTab('exams')} style={{ cursor: 'pointer' }}>
                            <div className="stat-title">Exam Blueprints</div>
                            <div className="stat-val" style={{ color: 'var(--purple)' }}>{stats.totalExams}</div>
                            <div className="stat-sub">Subject-wise Question Allocations</div>
                        </div>
                    </div>

                    {/* 📊 Live Subject-Wise Question Count Window (M1 - M9 Matrix) */}
                    <SubjectWiseCountWidget
                        counts={questionCounts}
                        onSelectSubject={() => setActiveTab('questions')}
                    />

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
            {activeTab === 'payments' && <PaymentsPanel />}
            {activeTab === 'reported' && (
                <ReportedQuestionsPanel
                    onChanged={loadStats}
                    onEditQuestion={(id) => { setFocusQuestionId(id); setActiveTab('questions'); }}
                />
            )}
            {activeTab === 'questions' && (
                <QuestionBankManager
                    onRefresh={loadStats}
                    focusQuestionId={focusQuestionId}
                    onFocusHandled={() => setFocusQuestionId(null)}
                />
            )}
            {activeTab === 'subject_codes' && <SubjectCodeManager onRefresh={loadStats} />}
            {activeTab === 'exams' && <ExamConfigList />}
            {activeTab === 'free_tests' && <FreeTestManager onRefresh={loadStats} />}
            {activeTab === 'reports' && <SystemReportsPage />}
            {activeTab === 'exam_paper' && <ExamPaperGenerator />}

        </div>
    );
};
