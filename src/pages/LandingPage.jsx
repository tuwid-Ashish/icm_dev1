import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../services/firestoreEngine.js';
import { useLanguage } from '../context/LanguageContext.jsx';

export const LandingPage = ({ onNavigate }) => {
    const [exams, setExams] = useState([]);
    const { t } = useLanguage();

    useEffect(() => {
        let isMounted = true;
        async function loadExams() {
            const loaded = await firestoreEngine.getExams();
            if (isMounted) setExams(loaded);
        }
        loadExams();
        return () => { isMounted = false; };
    }, []);

    return (
        <div>
            {/* Hero Section */}
            <section style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', padding: '3.5rem 1.25rem', textAlign: 'center' }}>
                <div style={{ maxWidth: '920px', margin: '0 auto' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--primary)', marginBottom: '1rem' }}>
                        {t('landing_subtitle')}
                    </div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.75rem, 5vw, 3.3rem)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.18, marginBottom: '1.25rem' }}>
                        {t('landing_title')}
                    </h1>
                    <p style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.15rem)', color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: 1.6, maxWidth: '800px', margin: '0 auto 2rem auto' }}>
                        {t('landing_desc')}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-lg" style={{ padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 800, minWidth: '220px' }} onClick={() => onNavigate('signup')}>
                            {t('get_started_free')}
                        </button>
                        <button className="btn btn-secondary btn-lg" style={{ padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 700, minWidth: '220px' }} onClick={() => onNavigate('login')}>
                            {t('sign_in_portal')}
                        </button>
                    </div>
                </div>
            </section>

            {/* 4 Value Pillars Grid */}
            <section style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', padding: '4rem 1.5rem' }}>
                <div className="container" style={{ padding: 0 }}>
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.1rem', fontWeight: 800 }}>
                            {t('why_aspirants_train')}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>{t('why_desc')}</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
                        <div className="card" style={{ background: 'var(--bg-surface)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                {t('pillar_1_tag')}
                            </div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>{t('pillar_1_title')}</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                {t('pillar_1_desc')}
                            </p>
                        </div>

                        <div className="card" style={{ background: 'var(--bg-surface)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--success)', marginBottom: '0.5rem' }}>
                                {t('pillar_2_tag')}
                            </div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>{t('pillar_2_title')}</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                {t('pillar_2_desc')}
                            </p>
                        </div>

                        <div className="card" style={{ background: 'var(--bg-surface)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--purple)', marginBottom: '0.5rem' }}>
                                {t('pillar_3_tag')}
                            </div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>{t('pillar_3_title')}</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                {t('pillar_3_desc')}
                            </p>
                        </div>

                        <div className="card" style={{ background: 'var(--bg-surface)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--indigo)', marginBottom: '0.5rem' }}>
                                {t('pillar_4_tag')}
                            </div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>{t('pillar_4_title')}</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                {t('pillar_4_desc')}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Target Exam Selection Cards */}
            <section className="container">
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.4rem' }}>
                        {t('recruitment_patterns_tag')}
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.1rem', fontWeight: 800 }}>
                        {t('recruitment_boards')}
                    </h2>
                    <p style={{ color: 'var(--text-muted)' }}>{t('recruitment_boards_desc')}</p>
                </div>

                <div className="cards-equal-grid">
                    {exams.map(e => (
                        <div key={e.id} className="exam-select-card" onClick={() => onNavigate('signup')}>
                            <div>
                                <div className="exam-card-medium">{e.medium}</div>
                                <h3 className="exam-card-title">{e.name}</h3>
                                <p className="exam-card-desc">{e.description}</p>

                                <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.25rem' }}>
                                    <div>{t('duration_label')}: <strong>{e.durationMinutes} {t('mins_unit')}</strong></div>
                                    <div>{t('total_questions_label')}: <strong>{e.totalQuestions}</strong></div>
                                    <div>{t('total_marks_label')}: <strong>{e.totalMarks}</strong></div>
                                    <div>{t('negative_rate_label')}: <strong>{e.negativeMarkingRate}</strong></div>
                                </div>

                                <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                    {t('subject_split_label')}
                                </div>
                                <ul style={{ listStyle: 'none', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                                    {e.subjects.map(s => (
                                        <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-color)' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>• {s.name}</span>
                                            <strong style={{ color: 'var(--text-primary)' }}>{s.questionsCount} {t('qs_unit')} ({(s.questionsCount || 0) * (s.marksPerQuestion || 1)} {t('marks_unit')})</strong>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button className="btn btn-primary" style={{ width: '100%', fontWeight: 700 }}>
                                {t('start_mock_test')}
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Exam Qualification & Assurance Section */}
            <section style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)', padding: '4rem 1.5rem', textAlign: 'center' }}>
                <div style={{ maxWidth: '850px', margin: '0 auto' }}>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>
                        {t('qualifying_standards')}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.6 }}>
                        {t('qualifying_desc')}
                    </p>
                    <button className="btn btn-primary btn-lg" style={{ padding: '0.9rem 2.25rem', fontSize: '1.05rem', fontWeight: 800 }} onClick={() => onNavigate('signup')}>
                        {t('create_free_account')}
                    </button>
                </div>
            </section>
        </div>
    );
};
