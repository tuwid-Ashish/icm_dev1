import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useExam } from '../../context/ExamContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { Modal } from '../../components/common/Modal.jsx';
import { DashboardShell } from '../../layouts/DashboardShell.jsx';

export const FreeTestsPage = () => {
    const { user } = useAuth();
    const { startPracticeTest } = useExam();
    const { t } = useLanguage();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedExam, setSelectedExam] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [testMode, setTestMode] = useState('full');
    const [selectedSubject, setSelectedSubject] = useState('ALL');

    useEffect(() => {
        (async () => {
            setLoading(true);
            const loaded = await firestoreEngine.getExams();
            setExams(loaded.filter(e => e.isFreeTest));
            setLoading(false);
        })();
    }, []);

    const handleOpenModal = (exam) => {
        setSelectedExam(exam);
        setTestMode('full');
        setSelectedSubject('ALL');
        setModalOpen(true);
    };

    const handleLaunchTest = async () => {
        if (!selectedExam) return;
        setModalOpen(false);
        const subj = testMode === 'subject' ? selectedSubject : 'ALL';
        const studentId = user ? (user.uid || user.id) : null;
        const studentName = user?.name || 'Student User';
        const studentEmail = user?.email || 'student@sigma.com';
        const res = await startPracticeTest(studentId, selectedExam.id, subj, undefined, { studentName, studentEmail });
        if (res?.error) alert(res.error);
    };

    return (
        <DashboardShell>
            <div>
                <div style={{ marginBottom: '1.75rem' }}>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.1rem', fontWeight: 800 }}>
                        {t('nav_free_tests')}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                        {t('nav_free_tests_desc')}
                    </p>
                </div>

                {loading ? (
                    <div className="card"><p style={{ color: 'var(--text-muted)' }}>{t('loading_boards')}</p></div>
                ) : exams.length === 0 ? (
                    <div className="card"><p style={{ color: 'var(--text-muted)' }}>No free tests are available right now.</p></div>
                ) : (
                    <div className="cards-equal-grid">
                        {exams.map(e => (
                            <div key={e.id} className="exam-select-card" onClick={() => handleOpenModal(e)}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <div className="exam-card-medium">{e.medium}</div>
                                        <span className="badge badge-success">{t('free_test_badge')}</span>
                                    </div>

                                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                                        {e.name}
                                    </h4>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                                        {e.description || 'Full length online CBT practice test series.'}
                                    </p>

                                    <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '1.5rem' }}>
                                        <div>Duration: <strong>{e.durationMinutes} Mins</strong></div>
                                        <div>Questions: <strong>{e.totalQuestions} Qs</strong></div>
                                        <div>Total Marks: <strong>{e.totalMarks} M</strong></div>
                                        <div>Negative Rate: <strong>{e.negativeMarkingRate}</strong></div>
                                    </div>
                                </div>

                                <button className="btn btn-primary" style={{ width: '100%', fontWeight: 700 }}>
                                    {t('launch_free_test')}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedExam && (
                <Modal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    title={`${t('configure_test_title')}: ${selectedExam.name}`}
                    maxWidth="600px"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t('cancel_btn')}</button>
                            <button className="btn btn-primary" onClick={handleLaunchTest}>{t('start_examination')}</button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label className="form-label">{t('select_practice_mode')}</label>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                                className={`btn ${testMode === 'full' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ flex: 1, minWidth: '140px' }}
                                onClick={() => setTestMode('full')}
                            >
                                {t('full_mock_blueprint')}
                            </button>
                            <button
                                className={`btn ${testMode === 'subject' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ flex: 1, minWidth: '140px' }}
                                onClick={() => setTestMode('subject')}
                            >
                                {t('random_subject_practice')}
                            </button>
                        </div>
                    </div>

                    {testMode === 'subject' && (
                        <div className="form-group">
                            <label className="form-label">{t('select_subject_section')}</label>
                            <select
                                className="form-control"
                                value={selectedSubject}
                                onChange={e => setSelectedSubject(e.target.value)}
                            >
                                <option value="ALL">{t('all_subjects_mixed')}</option>
                                {selectedExam.subjects && selectedExam.subjects.map(s => (
                                    <option key={s.id || s.name} value={s.name}>{s.name} ({s.questionsCount} {t('qs_unit')})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                        <div>Test Access: <strong style={{ color: 'var(--success)' }}>FREE TEST (No Quota Required)</strong></div>
                        <div>Mode: <strong>{testMode === 'full' ? t('full_mock_blueprint') : `${t('random_subject_practice')} (${selectedSubject})`}</strong></div>
                        <div>Duration: <strong>{selectedExam.durationMinutes} Minutes</strong></div>
                        <div>Negative Penalty: <strong>{selectedExam.negativeMarkingRate} per wrong answer</strong></div>
                    </div>
                </Modal>
            )}
        </DashboardShell>
    );
};
