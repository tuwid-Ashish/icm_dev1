import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useExam } from '../../context/ExamContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { Modal } from '../../components/common/Modal.jsx';

export const ExamCatalogPage = () => {
    const { user } = useAuth();
    const { startPracticeTest } = useExam();
    const { t } = useLanguage();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal state for starting paper
    const [selectedExam, setSelectedExam] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [testMode, setTestMode] = useState('full');
    const [selectedSubject, setSelectedSubject] = useState('ALL');

    useEffect(() => {
        let isMounted = true;
        async function loadExams() {
            setLoading(true);
            const loaded = await firestoreEngine.getExams();
            if (isMounted) {
                setExams(loaded);
                setLoading(false);
            }
        }
        loadExams();
        return () => { isMounted = false; };
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

    // Syllabus Topic Coverage Data per Exam
    const syllabusDetails = {
        police_bharti: [
            { subject: 'Mathematics (अंकगणित)', topics: 'Arithmetic, Percentages, Ratio & Proportion, HCF & LCM, Time & Work, Profit & Loss' },
            { subject: 'General Knowledge & Current Affairs', topics: 'Maharashtra History, Geography, Indian Constitution, Current Events, General Science' },
            { subject: 'Marathi Grammar (मराठी व्याकरण)', topics: 'Varnamala, Samas, Sandhi, Shabdanchya Jati, Prayog, Mhani & Vakyaprachar' },
            { subject: 'Intelligence Test / Reasoning', topics: 'Coding-Decoding, Series Completion, Blood Relations, Syllogism, Direction Sense' }
        ],
        vanrakshak: [
            { subject: 'Marathi', topics: 'Grammar, Vocabulary, Sentence Structure, Synonyms & Antonyms, Comprehension' },
            { subject: 'English', topics: 'Grammar, Tenses, Vocabulary, Error Spotting, Idioms & Phrases, Passage Reading' },
            { subject: 'General Knowledge', topics: 'Forest & Wildlife Conservation, Environmental Science, Geography of Maharashtra' },
            { subject: 'Intelligence Test', topics: 'Logical Reasoning, Pattern Recognition, Analytical Reasoning, Data Interpretation' }
        ],
        ssc_gd: [
            { subject: 'General Intelligence & Reasoning', topics: 'Analogies, Spatial Visualization, Visual Memory, Non-verbal Series, Coding' },
            { subject: 'General Knowledge & General Awareness', topics: 'India & Neighboring Countries, Sports, History, Culture, Economics, General Policy' },
            { subject: 'Elementary Mathematics', topics: 'Number Systems, Decimals, Fractions, Interest, Averages, Ratio & Time, Mensuration' },
            { subject: 'English / Hindi', topics: 'Basic Comprehension, Error Spotting, Fill in the Blanks, Vocabulary, Grammar' }
        ]
    };

    return (
        <div>
            {/* Page Header */}
            <div style={{ marginBottom: '1.75rem' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.1rem', fontWeight: 800 }}>
                    {t('catalog_page_title')}
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                    {t('catalog_page_desc')}
                </p>
            </div>

            {loading ? (
                <div className="card"><p style={{ color: 'var(--text-muted)' }}>{t('loading_boards')}</p></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {exams.map(e => {
                        const syllabus = syllabusDetails[e.id] || [];
                        const isAccessible = e.isFreeTest || (
                            (user?.remainingTests || 0) > 0 && 
                            ((user?.purchasedPackages || []).length === 0 || (user?.purchasedPackages || []).some(p => p.exam === e.name || p.exam === e.code || e.name.includes(p.exam)))
                        );

                        return (
                            <div key={e.id} className="card">
                                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.25rem' }}>
                                            {e.medium}
                                        </div>
                                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800 }}>{e.name}</h2>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{e.description}</p>
                                    </div>

                                    <button 
                                        className={`btn ${!isAccessible ? 'btn-secondary' : 'btn-primary'} btn-lg`}
                                        style={{ minWidth: '220px' }}
                                        disabled={!isAccessible}
                                        onClick={() => handleOpenModal(e)}
                                    >
                                        {!isAccessible ? ((user?.remainingTests || 0) <= 0 ? t('quota_exhausted_btn') : t('package_purchase_required_btn')) : t('configure_launch_paper')}
                                    </button>
                                </div>

                                {/* Examination Key Metrics Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                                    <div>{t('duration_label')}: <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{e.durationMinutes} {t('mins_unit')}</strong></div>
                                    <div>{t('questions_label')}: <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{e.totalQuestions} {t('qs_unit')}</strong></div>
                                    <div>{t('total_marks_label')}: <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{e.totalMarks} {t('marks_unit')}</strong></div>
                                    <div>{t('negative_rate_label')}: <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{e.negativeMarkingRate} {t('per_wrong_unit')}</strong></div>
                                    <div>{t('min_cutoff_label')}: <strong style={{ fontSize: '1rem', color: 'var(--success)' }}>{e.minQualifyingPercent}%</strong></div>
                                </div>

                                {/* Subject Weightage & Syllabus Breakdown Table */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                                        {t('subject_weightage_title')}
                                    </h3>
                                    
                                    <div className="table-wrapper">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>{t('subject_section_th')}</th>
                                                    <th>{t('question_split_th')}</th>
                                                    <th>{t('mark_weight_th')}</th>
                                                    <th>{t('syllabus_topics_th')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {e.subjects.map((s, idx) => {
                                                    const sylTopic = syllabus[idx]?.topics || 'Comprehensive section questions matching official blueprint';
                                                    return (
                                                        <tr key={s.id}>
                                                            <td><strong>{s.name}</strong></td>
                                                            <td>{s.questionsCount} {t('questions_label')}</td>
                                                            <td><strong>{s.questionsCount * s.marksPerQuestion} {t('marks_unit')}</strong></td>
                                                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{sylTopic}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Practice Test Configuration Modal */}
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <button 
                                className={`btn ${testMode === 'full' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setTestMode('full')}
                            >
                                {t('full_mock_blueprint')}
                            </button>
                            <button 
                                className={`btn ${testMode === 'subject' ? 'btn-primary' : 'btn-secondary'}`}
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
                        <div>Mode: <strong>{testMode === 'full' ? t('full_mock_blueprint') : `${t('random_subject_practice')} (${selectedSubject})`}</strong></div>
                        <div>{t('duration_label')}: <strong>{selectedExam.durationMinutes} {t('mins_unit')}</strong></div>
                        <div>{t('negative_rate_label')}: <strong>{selectedExam.negativeMarkingRate} {t('per_wrong_unit')}</strong></div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
