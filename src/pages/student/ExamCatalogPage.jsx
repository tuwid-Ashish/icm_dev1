import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useExam } from '../../context/ExamContext.jsx';

export const ExamCatalogPage = () => {
    const { user } = useAuth();
    const { startPracticeTest } = useExam();
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

    const handleLaunchTest = () => {
        if (!selectedExam) return;
        setModalOpen(false);
        const subj = testMode === 'subject' ? selectedSubject : 'ALL';
        const res = startPracticeTest(user?.id || 'std_101', selectedExam.id, subj);
        if (res.error) alert(res.error);
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
                    Exam Catalog & Official Syllabus Explorer
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                    Explore detailed subject weightages, official topic coverage, and qualifying cutoff criteria.
                </p>
            </div>

            {loading ? (
                <div className="card"><p style={{ color: 'var(--text-muted)' }}>Loading examination catalog...</p></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {exams.map(e => {
                        const syllabus = syllabusDetails[e.id] || [];
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
                                        className="btn btn-primary btn-lg"
                                        disabled={user?.remainingTests <= 0}
                                        onClick={() => handleOpenModal(e)}
                                    >
                                        Configure & Launch Paper
                                    </button>
                                </div>

                                {/* Examination Key Metrics Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                                    <div>Duration: <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{e.durationMinutes} Mins</strong></div>
                                    <div>Total Questions: <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{e.totalQuestions} Qs</strong></div>
                                    <div>Total Marks: <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{e.totalMarks} M</strong></div>
                                    <div>Negative Rate: <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{e.negativeMarkingRate} per wrong</strong></div>
                                    <div>Min Qualifying Cutoff: <strong style={{ fontSize: '1rem', color: 'var(--success)' }}>{e.minQualifyingPercent}%</strong></div>
                                </div>

                                {/* Subject Weightage & Syllabus Breakdown Table */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                                        Subject Weightage & Official Syllabus Topics
                                    </h3>
                                    
                                    <div className="table-wrapper">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Subject Section</th>
                                                    <th>Question Split</th>
                                                    <th>Mark Weight</th>
                                                    <th>Official Syllabus Topics Covered</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {e.subjects.map((s, idx) => {
                                                    const sylTopic = syllabus[idx]?.topics || 'Comprehensive section questions matching official blueprint';
                                                    return (
                                                        <tr key={s.id}>
                                                            <td><strong>{s.name}</strong></td>
                                                            <td>{s.questionsCount} Questions</td>
                                                            <td><strong>{s.questionsCount * s.marksPerQuestion} Marks</strong></td>
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

            {/* Modal */}
            {modalOpen && selectedExam && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <div className="modal-header" style={{ marginBottom: '1.25rem' }}>
                            <h3 className="card-title">Configure Practice Test: {selectedExam.name}</h3>
                            <button className="modal-close" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Select Practice Mode</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <button 
                                    className={`btn ${testMode === 'full' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setTestMode('full')}
                                >
                                    Full Mock Blueprint
                                </button>
                                <button 
                                    className={`btn ${testMode === 'subject' ? 'btn-primary' : 'btn-secondary'}`}
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
                                    {selectedExam.subjects.map(s => (
                                        <option key={s.id} value={s.name}>{s.name} ({s.questionsCount} Qs)</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                            <div>Mode: <strong>{testMode === 'full' ? 'Official Full Mock Exam' : `Subject Practice (${selectedSubject})`}</strong></div>
                            <div>Duration: <strong>{selectedExam.durationMinutes} Minutes</strong></div>
                            <div>Negative Penalty: <strong>{selectedExam.negativeMarkingRate} per wrong answer</strong></div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleLaunchTest}>Start Examination</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
