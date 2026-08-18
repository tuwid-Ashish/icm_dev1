import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { generateExamPaper, evaluateSubmission } from '../services/examEngine.js';
import { firestoreEngine } from '../services/firestoreEngine.js';
import { useAuth } from './AuthContext.jsx';

const ExamContext = createContext(null);

export const ExamProvider = ({ children }) => {
    const { refreshUser } = useAuth();
    
    // Active session state and ref for zero stale closure bugs
    const [activeSession, setActiveSessionState] = useState(() => {
        const saved = localStorage.getItem('sigma_active_session');
        return saved ? JSON.parse(saved) : null;
    });

    const activeSessionRef = useRef(activeSession);
    activeSessionRef.current = activeSession;

    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(() => {
        const saved = localStorage.getItem('sigma_current_q_idx');
        return saved ? parseInt(saved, 10) : 0;
    });

    const [timerSeconds, setTimerSeconds] = useState(() => {
        const saved = localStorage.getItem('sigma_timer_seconds');
        return saved ? parseInt(saved, 10) : 0;
    });

    const timerRef = useRef(timerSeconds);
    timerRef.current = timerSeconds;

    const [activeResult, setActiveResult] = useState(null);

    // Sync session to localStorage to survive page refreshes
    const updateActiveSession = (newSessionOrUpdater) => {
        setActiveSessionState((prev) => {
            const next = typeof newSessionOrUpdater === 'function' ? newSessionOrUpdater(prev) : newSessionOrUpdater;
            activeSessionRef.current = next;
            if (next) {
                localStorage.setItem('sigma_active_session', JSON.stringify(next));
            } else {
                localStorage.removeItem('sigma_active_session');
                localStorage.removeItem('sigma_current_q_idx');
                localStorage.removeItem('sigma_timer_seconds');
            }
            return next;
        });
    };

    // Live countdown timer effect with auto-submit at 0
    useEffect(() => {
        let interval = null;
        if (activeSession && timerSeconds > 0) {
            interval = setInterval(() => {
                setTimerSeconds((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        // Auto submit test using latest ref
                        submitCurrentTest();
                        return 0;
                    }
                    const nextSecs = prev - 1;
                    localStorage.setItem('sigma_timer_seconds', nextSecs.toString());
                    return nextSecs;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeSession]);

    // Save current question index
    const changeQuestionIdx = (idx) => {
        setCurrentQuestionIdx(idx);
        localStorage.setItem('sigma_current_q_idx', idx.toString());
    };

    // Start Practice Test
    const startPracticeTest = async (studentId, examId, subjectFilter = 'ALL', count, studentInfo) => {
        const session = await generateExamPaper(studentId, examId, subjectFilter, count, studentInfo);
        if (session.error) {
            return session;
        }

        // Quota is deducted on successful submission (see submitCurrentTest), not
        // here at start — an abandoned/incomplete test must not cost a test slot.

        const durationSecs = session.durationMinutes * 60;
        updateActiveSession(session);
        changeQuestionIdx(0);
        setTimerSeconds(durationSecs);
        localStorage.setItem('sigma_timer_seconds', durationSecs.toString());
        setActiveResult(null);

        return { success: true, session };
    };

    // Update Answer (Guaranteed instant persistence)
    const updateAnswer = (questionId, optionIndex) => {
        updateActiveSession((prev) => {
            if (!prev) return null;
            const nextAnswers = { ...prev.userAnswers, [questionId]: optionIndex };
            const nextStates = { ...prev.paletteStates };
            
            if (nextStates[questionId] === 'marked' || nextStates[questionId] === 'answered_marked') {
                nextStates[questionId] = 'answered_marked';
            } else {
                nextStates[questionId] = 'answered';
            }

            return {
                ...prev,
                userAnswers: nextAnswers,
                paletteStates: nextStates
            };
        });
    };

    // Clear Answer Choice
    const clearAnswer = (questionId) => {
        updateActiveSession((prev) => {
            if (!prev) return null;
            const nextAnswers = { ...prev.userAnswers };
            delete nextAnswers[questionId];
            const nextStates = { ...prev.paletteStates };
            nextStates[questionId] = 'visited';
            return {
                ...prev,
                userAnswers: nextAnswers,
                paletteStates: nextStates
            };
        });
    };

    // Mark for Review & Next
    const markForReview = (questionId) => {
        updateActiveSession((prev) => {
            if (!prev) return null;
            const nextStates = { ...prev.paletteStates };
            const isAns = prev.userAnswers && prev.userAnswers[questionId] !== undefined;
            nextStates[questionId] = isAns ? 'answered_marked' : 'marked';
            return { ...prev, paletteStates: nextStates };
        });

        // Advance to next question if available
        if (activeSessionRef.current && currentQuestionIdx < activeSessionRef.current.questions.length - 1) {
            changeQuestionIdx(currentQuestionIdx + 1);
        }
    };

    // Save & Next
    const saveAndNext = (questionId) => {
        const currentSession = activeSessionRef.current;
        if (!currentSession) return;

        updateActiveSession((prev) => {
            if (!prev) return null;
            const nextStates = { ...prev.paletteStates };
            const hasAnswer = prev.userAnswers && prev.userAnswers[questionId] !== undefined;

            if (hasAnswer) {
                if (nextStates[questionId] === 'marked' || nextStates[questionId] === 'answered_marked') {
                    nextStates[questionId] = 'answered_marked';
                } else {
                    nextStates[questionId] = 'answered';
                }
            } else if (!nextStates[questionId] || nextStates[questionId] === 'not_visited') {
                nextStates[questionId] = 'visited';
            }
            return { ...prev, paletteStates: nextStates };
        });

        if (currentQuestionIdx < currentSession.questions.length - 1) {
            const nextIdx = currentQuestionIdx + 1;
            changeQuestionIdx(nextIdx);

            // Mark next question as visited if not_visited
            const nextQ = currentSession.questions[nextIdx];
            if (nextQ) {
                updateActiveSession((prev) => {
                    if (!prev) return null;
                    const nextStates = { ...prev.paletteStates };
                    if (!nextStates[nextQ.id] || nextStates[nextQ.id] === 'not_visited') {
                        nextStates[nextQ.id] = 'visited';
                    }
                    return { ...prev, paletteStates: nextStates };
                });
            }
        }
    };

    // Jump to specific Question (Palette click or Previous button)
    const jumpToQuestion = (targetIdx) => {
        const currentSession = activeSessionRef.current;
        if (!currentSession || targetIdx < 0 || targetIdx >= currentSession.questions.length) return;

        const targetQ = currentSession.questions[targetIdx];
        updateActiveSession((prev) => {
            if (!prev) return null;
            const nextStates = { ...prev.paletteStates };
            if (!nextStates[targetQ.id] || nextStates[targetQ.id] === 'not_visited') {
                nextStates[targetQ.id] = 'visited';
            }
            return { ...prev, paletteStates: nextStates };
        });

        changeQuestionIdx(targetIdx);
    };

    // Submit Current Test Session (Using latest ref for 100% accuracy)
    const submitCurrentTest = async () => {
        const sessionToSubmit = activeSessionRef.current;
        if (!sessionToSubmit) return;

        const totalMins = sessionToSubmit.durationMinutes;
        const timeTakenSecs = Math.max(1, totalMins * 60 - timerRef.current);

        // Evaluate submission with complete userAnswers
        const evaluated = evaluateSubmission(sessionToSubmit, timeTakenSecs);

        // Save scorecard submission to Cloud Firestore & LocalStorage
        await firestoreEngine.saveSubmission(evaluated);

        // Only a successfully submitted, non-free test consumes a quota slot.
        if (!sessionToSubmit.isFreeTest) {
            await firestoreEngine.decrementStudentQuota(sessionToSubmit.studentId);
            refreshUser();
        }

        // Clear active session
        updateActiveSession(null);
        setTimerSeconds(0);
        setActiveResult(evaluated);
    };

    // Abandon the current test without submitting — no scorecard is saved
    // and, since quota is only ever decremented on a real submit, no
    // quota slot is consumed either. Used by the "Exit" confirmation on
    // the exam screen.
    const exitPracticeTest = () => {
        updateActiveSession(null);
        setTimerSeconds(0);
    };

    return (
        <ExamContext.Provider value={{
            activeSession,
            currentQuestionIdx,
            timerSeconds,
            activeResult,
            setActiveResult,
            setCurrentQuestionIdx: changeQuestionIdx,
            startPracticeTest,
            updateAnswer,
            clearAnswer,
            markForReview,
            saveAndNext,
            jumpToQuestion,
            submitCurrentTest,
            exitPracticeTest
        }}>
            {children}
        </ExamContext.Provider>
    );
};

export const useExam = () => useContext(ExamContext);
