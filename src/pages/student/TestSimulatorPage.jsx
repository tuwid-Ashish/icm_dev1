import React, { useState } from 'react';
import { useExam } from '../../context/ExamContext.jsx';
import { Modal } from '../../components/common/Modal.jsx';

export const TestSimulatorPage = () => {
    const { 
        activeSession, 
        currentQuestionIdx, 
        timerSeconds, 
        updateAnswer, 
        clearAnswer, 
        markForReview, 
        saveAndNext, 
        jumpToQuestion, 
        submitCurrentTest
    } = useExam();

    const [verifyModalOpen, setVerifyModalOpen] = useState(false);

    if (!activeSession || !activeSession.questions || activeSession.questions.length === 0) {
        return <div className="card"><p>No active practice session found.</p></div>;
    }

    const totalQs = activeSession.questions.length;
    const isLastQuestion = currentQuestionIdx === totalQs - 1;
    const q = activeSession.questions[currentQuestionIdx];
    const userAns = activeSession.userAnswers ? activeSession.userAnswers[q.id] : undefined;

    // Prominent Digital Timer format (HH:MM:SS or MM:SS)
    const hours = Math.floor(timerSeconds / 3600);
    const mins = Math.floor((timerSeconds % 3600) / 60);
    const secs = timerSeconds % 60;
    
    const timeStr = hours > 0 
        ? `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    const isTimerWarning = timerSeconds < 300; // < 5 mins

    let notVisitedCount = 0;
    let visitedCount = 0;
    let answeredCount = 0;
    let markedCount = 0;
    let answeredMarkedCount = 0;

    activeSession.questions.forEach(item => {
        const st = (activeSession.paletteStates && activeSession.paletteStates[item.id]) || 'not_visited';
        if (st === 'not_visited') notVisitedCount++;
        else if (st === 'visited') visitedCount++;
        else if (st === 'answered') answeredCount++;
        else if (st === 'marked') markedCount++;
        else if (st === 'answered_marked') answeredMarkedCount++;
    });

    const handleSaveAndNextClick = () => {
        saveAndNext(q.id);
        if (isLastQuestion) {
            setVerifyModalOpen(true);
        }
    };

    const handleConfirmSubmit = () => {
        setVerifyModalOpen(false);
        submitCurrentTest();
    };

    return (
        <div className="cbt-shell">
            {/* Topbar with Prominent Digital Timer Header Box */}
            <div className="cbt-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className="badge badge-orange">{activeSession.examCode}</span>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800 }}>{activeSession.examName}</h3>
                </div>

                <div className={`cbt-timer-box ${isTimerWarning ? 'alert' : ''}`}>
                    <span>Time Remaining:</span>
                    <span>{timeStr}</span>
                </div>
            </div>

            <div className="cbt-main-grid">
                {/* Main Question Display Area */}
                <div className="cbt-q-container">
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>
                            <span>Question {currentQuestionIdx + 1} of {totalQs} ({q.subject || 'General Section'})</span>
                            <span>Marks: +{q.marks || 1} | Penalty: -{activeSession.negativeMarkingRate}</span>
                        </div>

                        <div className="q-box" style={{ marginBottom: '2rem' }}>
                            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                                {q.text}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {q.options.map((optText, optIdx) => {
                                    const isSelected = userAns === optIdx;
                                    const labelLetter = String.fromCharCode(65 + optIdx);
                                    return (
                                        <div 
                                            key={optIdx}
                                            className={`opt-card ${isSelected ? 'selected' : ''}`}
                                            onClick={() => updateAnswer(q.id, optIdx)}
                                        >
                                            <div className="opt-tag">{labelLetter}</div>
                                            <div style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{optText}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                                className="btn btn-secondary" 
                                disabled={currentQuestionIdx === 0}
                                onClick={() => jumpToQuestion(currentQuestionIdx - 1)}
                            >
                                Previous
                            </button>
                            <button className="btn btn-secondary" onClick={() => clearAnswer(q.id)}>
                                Clear Choice
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-secondary" style={{ borderColor: 'var(--purple-border)', color: 'var(--purple)' }} onClick={() => markForReview(q.id)}>
                                Mark for Review
                            </button>
                            <button className="btn btn-primary" onClick={handleSaveAndNextClick}>
                                {isLastQuestion ? 'Save & Review Test' : 'Save & Next'}
                            </button>
                            <button className="btn btn-danger" style={{ marginLeft: '0.5rem' }} onClick={() => setVerifyModalOpen(true)}>
                                Verify & Submit Test
                            </button>
                        </div>
                    </div>
                </div>

                {/* Calendar-like Question Palette Grid */}
                <div className="cbt-palette-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800 }}>Question Palette</h4>
                        <span className="badge badge-orange">{answeredCount + answeredMarkedCount} / {totalQs} Answered</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--success)' }}>Answered:</span> <strong>{answeredCount}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--warning)' }}>Visited / Jumped:</span> <strong>{visitedCount}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--purple)' }}>Marked for Review:</span> <strong>{markedCount}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--indigo)' }}>Answered & Marked:</span> <strong>{answeredMarkedCount}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Not Visited:</span> <strong>{notVisitedCount}</strong>
                        </div>
                    </div>

                    {/* Calendar-shaped Grid */}
                    <div className="calendar-palette-grid">
                        {activeSession.questions.map((item, idx) => {
                            const st = (activeSession.paletteStates && activeSession.paletteStates[item.id]) || 'not_visited';
                            const isActive = idx === currentQuestionIdx;
                            return (
                                <button 
                                    key={item.id}
                                    className={`cal-p-btn ${st} ${isActive ? 'active-q' : ''}`}
                                    onClick={() => jumpToQuestion(idx)}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Verification Dialog Modal */}
            <Modal
                isOpen={verifyModalOpen}
                onClose={() => setVerifyModalOpen(false)}
                title="Confirm Test Verification & Submission"
                maxWidth="540px"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setVerifyModalOpen(false)}>Return to Test</button>
                        <button className="btn btn-danger" onClick={handleConfirmSubmit}>Finalize & Submit</button>
                    </>
                }
            >
                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                    Are you sure you want to finalize and submit your test paper?
                </p>

                <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>Total Questions: <strong>{totalQs}</strong></div>
                    <div>Answered: <strong style={{ color: 'var(--success)' }}>{answeredCount + answeredMarkedCount}</strong></div>
                    <div>Unattempted / Jumped: <strong style={{ color: 'var(--warning)' }}>{visitedCount + notVisitedCount}</strong></div>
                    <div>Marked for Review: <strong style={{ color: 'var(--purple)' }}>{markedCount + answeredMarkedCount}</strong></div>
                </div>
            </Modal>
        </div>
    );
};
