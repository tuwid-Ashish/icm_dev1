import React from 'react';
import { useExam } from '../../context/ExamContext.jsx';
import { MathRenderer } from '../common/MathRenderer.jsx';

export const CBTSimulator = () => {
    const { 
        activeSession, 
        currentQuestionIdx, 
        timerSeconds, 
        updateAnswer, 
        clearAnswer, 
        markForReview, 
        saveAndNext, 
        jumpToQuestion, 
        submitCurrentTest,
        setCurrentQuestionIdx
    } = useExam();

    if (!activeSession || !activeSession.questions || activeSession.questions.length === 0) {
        return <div class="panel"><p>No active test session found.</p></div>;
    }

    const q = activeSession.questions[currentQuestionIdx];
    const userAns = activeSession.userAnswers[q.id];

    // Format timer
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const isTimerWarning = mins < 5;

    // Counts
    let notVisitedCount = 0;
    let visitedCount = 0;
    let answeredCount = 0;
    let markedCount = 0;
    let answeredMarkedCount = 0;

    activeSession.questions.forEach(item => {
        const st = activeSession.paletteStates[item.id] || 'not_visited';
        if (st === 'not_visited') notVisitedCount++;
        else if (st === 'visited') visitedCount++;
        else if (st === 'answered') answeredCount++;
        else if (st === 'marked') markedCount++;
        else if (st === 'answered_marked') answeredMarkedCount++;
    });

    const handleSubmitClick = () => {
        let answered = 0;
        let unattempted = 0;
        activeSession.questions.forEach(item => {
            if (activeSession.userAnswers[item.id] !== undefined) answered++;
            else unattempted++;
        });

        if (window.confirm(`Submit Exam?\n\n• Answered: ${answered}\n• Unattempted: ${unattempted}\n• Total Questions: ${activeSession.questions.length}`)) {
            submitCurrentTest();
        }
    };

    return (
        <div class="cbt-container">
            {/* Header */}
            <div class="cbt-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span class="badge badge-purple">{activeSession.examCode}</span>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem' }}>{activeSession.examName}</h3>
                </div>
                <div class={`cbt-timer ${isTimerWarning ? 'warning' : ''}`}>
                    ⏱️ Time Remaining: {timeStr}
                </div>
            </div>

            <div class="cbt-body">
                {/* Main Question Area */}
                <div class="cbt-question-area">
                    <div>
                        <div class="q-header">
                            <span>Question {currentQuestionIdx + 1} of {activeSession.questions.length} ({q.sectionName || 'General'})</span>
                            <span>Marks: +{q.marks || 1} | Neg: -{activeSession.negativeMarkingRate}</span>
                        </div>
                        <div className="question-card">
                            <div className="q-text">
                                <MathRenderer text={q.text} imageUrl={q.imageUrl || (q.questionImages && q.questionImages[0]?.url)} />
                            </div>

                            <div className="options-list">
                                {q.options.map((optText, optIdx) => {
                                    const isSelected = userAns === optIdx;
                                    const labelLetter = String.fromCharCode(65 + optIdx);
                                    return (
                                        <div 
                                            key={optIdx}
                                            className={`option-item ${isSelected ? 'selected' : ''}`}
                                            onClick={() => updateAnswer(q.id, optIdx)}
                                        >
                                            <div className="option-label">{labelLetter}</div>
                                            <div style={{ fontSize: '1rem' }}>
                                                <MathRenderer text={optText} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div class="cbt-actions">
                        <div>
                            <button 
                                class="btn btn-secondary" 
                                disabled={currentQuestionIdx === 0}
                                onClick={() => setCurrentQuestionIdx(prev => prev - 1)}
                            >
                                ◄ Previous
                            </button>
                            <button class="btn btn-secondary" onClick={() => clearAnswer(q.id)} style={{ marginLeft: '0.5rem' }}>
                                Clear Selection
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button class="btn btn-purple" style={{ background: 'var(--purple)', color: 'white' }} onClick={() => markForReview(q.id)}>
                                🔖 Mark for Review & Next
                            </button>
                            <button class="btn btn-primary" onClick={() => saveAndNext(q.id)}>
                                💾 Save & Next ►
                            </button>
                            <button class="btn btn-danger" style={{ marginLeft: '1rem' }} onClick={handleSubmitClick}>
                                📤 Submit Test
                            </button>
                        </div>
                    </div>
                </div>

                {/* Question Palette Sidebar */}
                <div class="cbt-palette-sidebar">
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>Question Palette</h4>

                    <div class="palette-legend">
                        <div class="legend-item"><div class="dot dot-answered"></div> Answered ({answeredCount})</div>
                        <div class="legend-item"><div class="dot dot-visited"></div> Visited ({visitedCount})</div>
                        <div class="legend-item"><div class="dot dot-marked"></div> Marked ({markedCount})</div>
                        <div class="legend-item"><div class="dot dot-answered-marked"></div> Ans & Marked ({answeredMarkedCount})</div>
                        <div class="legend-item"><div class="dot dot-not-visited"></div> Not Visited ({notVisitedCount})</div>
                    </div>

                    <div class="palette-grid">
                        {activeSession.questions.map((item, idx) => {
                            const st = activeSession.paletteStates[item.id] || 'not_visited';
                            const isActive = idx === currentQuestionIdx;
                            return (
                                <button 
                                    key={item.id}
                                    class={`palette-btn ${st} ${isActive ? 'active-q' : ''}`}
                                    onClick={() => jumpToQuestion(idx)}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
