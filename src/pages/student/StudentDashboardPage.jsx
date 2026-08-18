import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useExam } from '../../context/ExamContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { PackagePurchaseModal } from '../../components/student/PackagePurchaseModal.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { getExamAccess } from '../../utils/examAccess.js';
import { NavActionCard } from '../../components/common/NavActionCard.jsx';

export const StudentDashboardPage = ({ onNavigate }) => {
    const { user } = useAuth();
    const { startPracticeTest } = useExam();
    const { t } = useLanguage();
    const packagesRef = useRef(null);
    const examBoardsRef = useRef(null);
    const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const [exams, setExams] = useState([]);
    const [packages, setPackages] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const [selectedExam, setSelectedExam] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [testMode, setTestMode] = useState('full');
    const [selectedSubject, setSelectedSubject] = useState('ALL');

    // Package purchase modal
    const [selectedPkg, setSelectedPkg] = useState(null);
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);

    const loadDashboardData = async () => {
        setLoading(true);
        const uid = user ? (user.id || user.uid) : null;
        
        if (uid) {
            const profile = await firestoreEngine.getUserProfile(uid);
            setUserProfile(profile);
        } else {
            setUserProfile(null);
        }

        const loadedExams = await firestoreEngine.getExams();
        setExams(loadedExams);

        const loadedPkgs = await firestoreEngine.getPackages();
        setPackages(loadedPkgs.filter(p => p.status === 'active'));

        const subs = uid ? await firestoreEngine.getSubmissions(uid) : [];
        setSubmissions(subs);

        setLoading(false);
    };

    useEffect(() => {
        loadDashboardData();
    }, [user]);

    const handleExamCardClick = (exam) => {
        const access = getExamAccess(userProfile, exam);
        if (!access.unlocked) {
            const matchingPkg = packages.find(p => p.examId === exam.id);
            if (!matchingPkg) {
                alert(`No package is currently configured to unlock "${exam.name}". Please contact support.`);
                return;
            }
            setSelectedPkg(matchingPkg);
            setPurchaseModalOpen(true);
            return;
        }

        setSelectedExam(exam);
        setTestMode('full');
        setSelectedSubject('ALL');
        setModalOpen(true);
    };

    const handleOpenPurchase = (pkg) => {
        setSelectedPkg(pkg);
        setPurchaseModalOpen(true);
    };

    const handleLaunchTest = async () => {
        if (!selectedExam) return;
        setModalOpen(false);
        const subj = testMode === 'subject' ? selectedSubject : 'ALL';
        const studentId = user ? (user.uid || user.id) : (userProfile ? (userProfile.uid || userProfile.id) : null);
        const studentName = user?.name || userProfile?.name || 'Student User';
        const studentEmail = user?.email || userProfile?.email || 'student@sigma.com';

        const res = await startPracticeTest(studentId, selectedExam.id, subj, undefined, { studentName, studentEmail });
        if (res?.error) alert(res.error);
    };

    return (
        <div style={{ width: '100%' }}>
            {/* Top Quota Metrics Banner */}
            <div className="stats-grid">
                <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <div className="stat-title">📊 {t('remaining_tokens')}</div>
                    <div className="stat-val" style={{ color: 'var(--primary)' }}>{userProfile ? (userProfile.remainingTests || 0) : 0} {t('tokens_unit')}</div>
                    <div className="stat-sub">
                        {userProfile && (userProfile.remainingTests > 0) ? t('active_subscription') : t('no_tests_left')}
                    </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
                    <div className="stat-title">✅ {t('completed_mock_tests')}</div>
                    <div className="stat-val" style={{ color: 'var(--success)' }}>{submissions.length} {t('attempted_unit')}</div>
                    <div className="stat-sub">{t('scorecards_evaluated')}</div>
                </div>

                {/* <div className="stat-card" style={{ borderLeft: '4px solid var(--purple)' }}>
                    <div className="stat-title">📦 {t('purchased_packages')}</div>
                    <div className="stat-val" style={{ color: 'var(--purple)' }}>{userProfile && userProfile.purchasedPackages ? userProfile.purchasedPackages.length : 0} {t('plans_unit')}</div>
                    <div className="stat-sub">{t('active_subscriptions')}</div>
                </div> */}
            </div>

            {/* Quick Action Navigation Cards */}
            <div className="nav-actions-grid">
                {/* <NavActionCard
                    icon="📄"
                    color="#4338ca"
                    title={t('nav_active_package')}
                    description={t('nav_active_package_desc')}
                    onClick={() => scrollTo(packagesRef)}
                /> */}
                <NavActionCard
                    icon="🕐"
                    color="#0891b2"
                    title={t('nav_test_history')}
                    description={t('nav_test_history_desc')}
                    onClick={() => onNavigate('history')}
                />
                <NavActionCard
                    icon="🛍️"
                    color="#ea580c"
                    title={t('nav_new_package')}
                    description={t('nav_new_package_desc')}
                    onClick={() => scrollTo(packagesRef)}
                />
                <NavActionCard
                    icon="📝"
                    color="#16a34a"
                    title={t('nav_free_tests')}
                    description={t('nav_free_tests_desc')}
                    onClick={() => scrollTo(examBoardsRef)}
                />
            </div>

            {/* Available Course Packages Store Banner */}
            <div className="card" ref={packagesRef}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title">{t('available_packages_title')}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('available_packages_desc')}</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {packages.map(pkg => {
                        const alreadyPurchased = (userProfile?.purchasedPackages || []).some(p => p.packageId === pkg.id);
                        return (
                            <div key={pkg.id} style={{ background: 'var(--bg-surface)', border: alreadyPurchased ? '1px solid var(--success-border)' : '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span className="badge badge-purple">{pkg.exam}</span>
                                        {alreadyPurchased ? (
                                            <span className="badge badge-success">✓ Purchased</span>
                                        ) : (
                                            <span className="badge badge-success">{pkg.validity}</span>
                                        )}
                                    </div>
                                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.35rem' }}>{pkg.name}</h4>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                        Includes <strong>{pkg.totalTests} Full Length Blueprint Tests</strong> with detailed solutions & accuracy analytics.
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>₹{pkg.discountPrice || pkg.price}</span>
                                        {pkg.discountPrice && pkg.discountPrice < pkg.price && (
                                            <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.9rem' }}>₹{pkg.price}</span>
                                        )}
                                    </div>
                                </div>

                                {alreadyPurchased ? (
                                    <button className="btn btn-secondary" style={{ width: '100%', fontWeight: 700 }} disabled>
                                        ✓ Already Active
                                    </button>
                                ) : (
                                    <button className="btn btn-primary" style={{ width: '100%', fontWeight: 700 }} onClick={() => handleOpenPurchase(pkg)}>
                                        Buy Package (UPI QR / UTR)
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Target Exam Selection Cards */}
            <div className="card" ref={examBoardsRef}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Target Recruitment Examination Boards</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Click any unlocked card to launch tests or purchase packages to unlock locked papers.</p>
                    </div>
                </div>

                {loading ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem 0' }}>Loading recruitment boards...</p>
                ) : (
                    <div className="cards-equal-grid">
                        {exams.map(e => {
                            const access = getExamAccess(userProfile, e);
                            const unlocked = access.unlocked;
                            return (
                                <div key={e.id} className="exam-select-card" onClick={() => handleExamCardClick(e)}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <div className="exam-card-medium">{e.medium}</div>
                                            <span className={`badge ${e.isFreeTest ? 'badge-success' : unlocked ? 'badge-purple' : 'badge-danger'}`}>
                                                {e.isFreeTest ? 'FREE TEST' : unlocked ? 'UNLOCKED MOCK' : 'PAID MOCK (LOCKED)'}
                                            </span>
                                        </div>

                                        <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                                            {e.name}
                                        </h4>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                                            {e.description || 'Full length online CBT practice test series.'}
                                        </p>

                                        <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: !unlocked && access.reason === 'no_package' ? '0.5rem' : '1.5rem' }}>
                                            <div>Duration: <strong>{e.durationMinutes} Mins</strong></div>
                                            <div>Questions: <strong>{e.totalQuestions} Qs</strong></div>
                                            <div>Total Marks: <strong>{e.totalMarks} M</strong></div>
                                            <div>Negative Rate: <strong>{e.negativeMarkingRate}</strong></div>
                                        </div>

                                        {!unlocked && access.reason === 'no_package' && (
                                            <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginBottom: '1rem', fontWeight: 600 }}>
                                                🔒 Requires the "{access.requiredExamName}" package
                                            </p>
                                        )}
                                    </div>

                                    <button className={`btn ${unlocked ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', fontWeight: 700 }}>
                                        {e.isFreeTest ? 'Start Free Test' : unlocked ? 'Start Test' : access.reason === 'quota_exhausted' ? 'Quota Exhausted (Buy More)' : 'Unlock Mock Exam (Buy Package)'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Test History */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Completed Practice Test Log</h3>
                </div>

                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Exam Name</th>
                                <th>Date & Time</th>
                                <th>Score</th>
                                <th>Percentage</th>
                                <th>Accuracy</th>
                                <th>Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No practice tests attempted yet. Select an exam board above to begin.
                                    </td>
                                </tr>
                            ) : (
                                submissions.map(sub => (
                                    <tr key={sub.id}>
                                        <td><strong>{sub.examName}</strong></td>
                                        <td><small>{new Date(sub.submittedAt).toLocaleString()}</small></td>
                                        <td><strong>{sub.finalScore} / {sub.totalMarks}</strong></td>
                                        <td>{sub.percentage}%</td>
                                        <td>{sub.accuracy}%</td>
                                        <td>
                                            <span className={`badge ${sub.passed ? 'badge-success' : 'badge-danger'}`}>
                                                {sub.passed ? 'QUALIFIED' : 'FAILED'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Practice Setup Modal */}
            {selectedExam && (
                <Modal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    title={`Configure Practice Test: ${selectedExam.name}`}
                    maxWidth="600px"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleLaunchTest}>Start Examination</button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label className="form-label">Select Practice Mode</label>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button 
                                className={`btn ${testMode === 'full' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ flex: 1, minWidth: '140px' }}
                                onClick={() => setTestMode('full')}
                            >
                                Full Mock Blueprint
                            </button>
                            <button 
                                className={`btn ${testMode === 'subject' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ flex: 1, minWidth: '140px' }}
                                onClick={() => setTestMode('subject')}
                            >
                                Random Subject Practice
                            </button>
                        </div>
                    </div>

                    {testMode === 'subject' && (
                        <div className="form-group">
                            <label className="form-label">Select Subject Section</label>
                            <select 
                                className="form-control"
                                value={selectedSubject}
                                onChange={e => setSelectedSubject(e.target.value)}
                            >
                                <option value="ALL">All Subjects Mixed</option>
                                {selectedExam.subjects && selectedExam.subjects.map(s => (
                                    <option key={s.id || s.name} value={s.name}>{s.name} ({s.questionsCount} Qs)</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                        <div>Test Access: <strong style={{ color: selectedExam.isFreeTest ? 'var(--success)' : 'var(--primary)' }}>{selectedExam.isFreeTest ? 'FREE TEST (No Quota Required)' : 'UNLOCKED MOCK TEST'}</strong></div>
                        <div>Mode: <strong>{testMode === 'full' ? 'Official Full Mock Exam' : `Subject Practice (${selectedSubject})`}</strong></div>
                        <div>Duration: <strong>{selectedExam.durationMinutes} Minutes</strong></div>
                        <div>Negative Penalty: <strong>{selectedExam.negativeMarkingRate} per wrong answer</strong></div>
                    </div>
                </Modal>
            )}

            {/* Package Purchase Modal */}
            <PackagePurchaseModal 
                pkg={selectedPkg}
                isOpen={purchaseModalOpen}
                onClose={() => setPurchaseModalOpen(false)}
                onSuccess={loadDashboardData}
            />
        </div>
    );
};
