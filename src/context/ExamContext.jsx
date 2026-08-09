import React, { createContext, useContext, useState, useEffect } from 'react';
import { generateExamPaper, evaluateSubmission } from '../services/examEngine.js';
import { firestoreEngine } from '../services/firestoreEngine.js';
import { useAuth } from './AuthContext.jsx';

const ExamContext = createContext(null);

export const ExamProvider = ({ children }) => {
    const { refreshUser } = useAuth();
    const [activeSession, setActiveSession] = useState(null);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [activeResult, setActiveResult] = useState(null);

    // Live countdown timer effect with auto-submit at 0
    useEffect(() => {
        let interval = null;
        if (activeSession && timerSeconds > 0) {
            interval = setInterval(() => {
                setTimerSeconds((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        // Auto submit test when timer expires
                        submitCurrentTest();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeSession, timerSeconds]);

    // Start Practice Test
    const startPracticeTest = (studentId, examId) => {
        const session = generateExamPaper(studentId, examId);
        if (session.error) {
            return session;
        }

        // Decrement quota in Firestore / Storage
        firestoreEngine.decrementStudentQuota(studentId);
        refreshUser();

        setActiveSession(session);
        setCurrentQuestionIdx(0);
        setTimerSeconds(session.durationMinutes * 60);
        setActiveResult(null);

        return { success: true, session };
    };

    // Update Answer
    const updateAnswer = (questionId, optionIndex) => {
        if (!activeSession) return;
        setActiveSession((prev) => {
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

    // Clear Answer
    const clearAnswer = (questionId) => {
        if (!activeSession) return;
        setActiveSession((prev) => {
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
        if (!activeSession) return;
        setActiveSession((prev) => {
            const nextStates = { ...prev.paletteStates };
            const isAns = prev.userAnswers[questionId] !== undefined;
            nextStates[questionId] = isAns ? 'answered_marked' : 'marked';
            return { ...prev, paletteStates: nextStates };
        });
        saveAndNext(questionId);
    };

    // Save & Next
    const saveAndNext = (questionId) => {
        if (!activeSession) return;
        setActiveSession((prev) => {
            const nextStates = { ...prev.paletteStates };
            if (!nextStates[questionId] || nextStates[questionId] === 'not_visited') {
                nextStates[questionId] = prev.userAnswers[questionId] !== undefined ? 'answered' : 'visited';
            }
            return { ...prev, paletteStates: nextStates };
        });

        if (currentQuestionIdx < activeSession.questions.length - 1) {
            setCurrentQuestionIdx((prev) => prev + 1);
        }
    };

    // Jump to specific Question
    const jumpToQuestion = (targetIdx) => {
        if (!activeSession || targetIdx < 0 || targetIdx >= activeSession.questions.length) return;

        const targetQ = activeSession.questions[targetIdx];
        setActiveSession((prev) => {
            const nextStates = { ...prev.paletteStates };
            if (!nextStates[targetQ.id] || nextStates[targetQ.id] === 'not_visited') {
                nextStates[targetQ.id] = 'visited';
            }
            return { ...prev, paletteStates: nextStates };
        });

        setCurrentQuestionIdx(targetIdx);
    };

    // Submit Current Test Session
    const submitCurrentTest = async () => {
        if (!activeSession) return;

        const totalMins = activeSession.durationMinutes;
        const timeTakenSecs = totalMins * 60 - timerSeconds;

        const evaluated = evaluateSubmission(activeSession, timeTakenSecs);

        // Save scorecard submission to Cloud Firestore
        await firestoreEngine.saveSubmission(evaluated);

        setActiveResult(evaluated);
        setActiveSession(null);
        setTimerSeconds(0);
    };

    return (
        <ExamContext.Provider value={{
            activeSession,
            currentQuestionIdx,
            timerSeconds,
            activeResult,
            setActiveResult,
            setCurrentQuestionIdx,
            startPracticeTest,
            updateAnswer,
            clearAnswer,
            markForReview,
            saveAndNext,
            jumpToQuestion,
            submitCurrentTest
        }}>
            {children}
        </ExamContext.Provider>
    );
};

export const useExam = () => useContext(ExamContext);
