import React from 'react';
import { storageService } from '../services/storageService.js';

export const LandingPage = ({ onNavigate }) => {
    const exams = storageService.getExams();

    return (
        <div>
            {/* Hero Section */}
            <section style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', padding: '5.5rem 1.5rem', textAlign: 'center' }}>
                <div style={{ maxWidth: '920px', margin: '0 auto' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--primary)', marginBottom: '1.25rem' }}>
                        Maharashtra State Recruitment Assessment Engine
                    </div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '3.3rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, marginBottom: '1.25rem' }}>
                        Engineered for Maharashtra Competitive Exam Aspirants
                    </h1>
                    <p style={{ fontSize: '1.15rem', color: 'var(--text-muted)', marginBottom: '2.25rem', lineHeight: 1.6, maxWidth: '800px', margin: '0 auto 2.25rem auto' }}>
                        Simulate authentic Computer-Based Tests (CBT) for Police Bharti, Forest Guard (Vanrakshak), and SSC GD with real-time countdown timers, negative marking evaluation, and bilingual Marathi & English question papers.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-lg" style={{ padding: '0.9rem 2.25rem', fontSize: '1.05rem', fontWeight: 800 }} onClick={() => onNavigate('signup')}>
                            Get Started Free
                        </button>
                        <button className="btn btn-secondary btn-lg" style={{ padding: '0.9rem 2.25rem', fontSize: '1.05rem', fontWeight: 700 }} onClick={() => onNavigate('login')}>
                            Sign In to Portal
                        </button>
                    </div>
                </div>
            </section>

            {/* 4 Value Pillars Grid */}
            <section style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', padding: '4rem 1.5rem' }}>
                <div className="container" style={{ padding: 0 }}>
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.1rem', fontWeight: 800 }}>
                            Why Aspirants Train on SigmaForce CEP
                        </h2>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Features designed to maximize speed, accuracy, and examination confidence.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
                        <div className="card" style={{ background: 'var(--bg-surface)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                Pillar 01
                            </div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>Official Blueprint Matching</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                Exam papers adhere strictly to official written notifications, durations, question counts, and subject distributions.
                            </p>
                        </div>

                        <div className="card" style={{ background: 'var(--bg-surface)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--success)', marginBottom: '0.5rem' }}>
                                Pillar 02
                            </div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>Instant Scorecard & Analytics</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                Get immediate evaluation post-test with gross score, negative deductions, net percentage, and question explanations.
                            </p>
                        </div>

                        <div className="card" style={{ background: 'var(--bg-surface)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--purple)', marginBottom: '0.5rem' }}>
                                Pillar 03
                            </div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>Randomized Subject Practice</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                Conduct full 90-minute CBT papers or target specific subjects like Mathematics, Reasoning, GK, and Marathi/English.
                            </p>
                        </div>

                        <div className="card" style={{ background: 'var(--bg-surface)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--indigo)', marginBottom: '0.5rem' }}>
                                Pillar 04
                            </div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>Quota & Balance Control</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                Track completed test attempts against set practice targets with automated remaining balance monitoring.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Target Exam Selection Cards (Clean Header Typography, Zero Text Overlaps) */}
            <section className="container">
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.4rem' }}>
                        Recruitment Examination Patterns
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.1rem', fontWeight: 800 }}>
                        Supported Recruitment Boards
                    </h2>
                    <p style={{ color: 'var(--text-muted)' }}>Configured based on official written examination notifications.</p>
                </div>

                <div className="cards-equal-grid">
                    {exams.map(e => (
                        <div key={e.id} className="exam-select-card" onClick={() => onNavigate('signup')}>
                            <div>
                                <div className="exam-card-medium">{e.medium}</div>
                                <h3 className="exam-card-title">{e.name}</h3>
                                <p className="exam-card-desc">{e.description}</p>

                                <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.25rem' }}>
                                    <div>Duration: <strong>{e.durationMinutes} mins</strong></div>
                                    <div>Total Qs: <strong>{e.totalQuestions}</strong></div>
                                    <div>Total Marks: <strong>{e.totalMarks}</strong></div>
                                    <div>Negative Rate: <strong>{e.negativeMarkingRate}</strong></div>
                                </div>

                                <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                    Subject Split
                                </div>
                                <ul style={{ listStyle: 'none', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                                    {e.subjects.map(s => (
                                        <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-color)' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>• {s.name}</span>
                                            <strong style={{ color: 'var(--text-primary)' }}>{s.questionsCount} Qs ({s.questionsCount * s.marksPerQuestion} Marks)</strong>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Action Button (Aligned at exact bottom baseline across all 3 cards) */}
                            <button className="btn btn-primary" style={{ width: '100%', fontWeight: 700 }}>
                                Start Mock Test
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Exam Qualification & Assurance Section */}
            <section style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)', padding: '4rem 1.5rem', textAlign: 'center' }}>
                <div style={{ maxWidth: '850px', margin: '0 auto' }}>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>
                        Minimum Qualifying Cutoff Standards
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.6 }}>
                        All practice test scorecards automatically evaluate your performance against the minimum qualifying threshold set by the respective recruitment board (Police Constable 40%, Forest Guard 45%, SSC GD 35%).
                    </p>
                    <button className="btn btn-primary btn-lg" style={{ padding: '0.9rem 2.25rem', fontSize: '1.05rem', fontWeight: 800 }} onClick={() => onNavigate('signup')}>
                        Create Free Student Account
                    </button>
                </div>
            </section>
        </div>
    );
};
