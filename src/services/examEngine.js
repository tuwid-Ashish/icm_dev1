/**
 * CEP Online Mock Test Platform - Exam & Paper Generation Engine
 * Supports Full Mock Papers and Random Subject Practice papers with Fisher-Yates Randomization.
 */

import { storageService } from './storageService.js';

class ExamEngine {
    /**
     * Fisher-Yates (Knuth) Shuffle algorithm for 100% unbiased, robust random question selection.
     */
    fisherYatesShuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    generatePracticeTest(studentId, examId, subjectFilter = 'ALL', count = 20, studentInfo = {}) {
        const exam = storageService.getExamById(examId);
        if (!exam) {
            return { error: 'Invalid exam selected.' };
        }

        // Engine-side Paywall & Quota Verification
        const currentUser = storageService.getCurrentUser();
        const isFree = exam.isFreeTest || false;

        if (!isFree) {
            const remaining = currentUser?.remainingTests || 0;
            if (remaining <= 0) {
                return { error: 'Insufficient test quota remaining. Please purchase a course package to launch mock tests.' };
            }
        }

        const allQuestions = storageService.getQuestions();
        const examBatchName = exam.name.includes('Police') ? 'Police Bharti' :
                            exam.name.includes('Forest') || exam.name.includes('Vanrakshak') ? 'Vanrakshak' :
                            exam.name.includes('SSC') ? 'SSC GD' : '';

        let batchQuestions = allQuestions.filter(q => 
            q.batch === examBatchName || 
            q.batch.toLowerCase().includes(exam.id) ||
            q.batch.toLowerCase().includes(exam.code.toLowerCase())
        );

        if (batchQuestions.length === 0) {
            batchQuestions = allQuestions;
        }

        // Apply Subject Filter if Random Subject Practice Mode selected
        if (subjectFilter && subjectFilter !== 'ALL') {
            const matched = batchQuestions.filter(q => 
                q.subject.toLowerCase().includes(subjectFilter.toLowerCase()) ||
                subjectFilter.toLowerCase().includes(q.subject.toLowerCase())
            );
            if (matched.length > 0) {
                batchQuestions = matched;
            }
        }

        // Perform Fisher-Yates True Randomization
        const randomizedPool = this.fisherYatesShuffle(batchQuestions);
        const selectedCount = Math.min(subjectFilter !== 'ALL' ? parseInt(count, 10) : (exam.totalQuestions || 20), randomizedPool.length);

        const generatedQuestions = [];
        for (let i = 0; i < selectedCount; i++) {
            generatedQuestions.push(randomizedPool[i]);
        }

        const paletteStates = {};
        generatedQuestions.forEach(q => {
            paletteStates[q.id] = 'not_visited';
        });

        const session = {
            id: 'SESSION-' + Date.now().toString(36).toUpperCase(),
            studentId,
            studentName: studentInfo?.studentName || currentUser?.name || 'Student User',
            studentEmail: studentInfo?.studentEmail || currentUser?.email || 'student@sigma.com',
            examId: exam.id,
            examName: subjectFilter !== 'ALL' ? `${exam.name} (${subjectFilter} Practice)` : exam.name,
            examCode: exam.code,
            durationMinutes: subjectFilter !== 'ALL' ? Math.ceil(selectedCount * 1.2) : exam.durationMinutes,
            negativeMarkingRate: exam.negativeMarkingRate,
            totalMarks: generatedQuestions.reduce((sum, q) => sum + (q.marks || 1), 0),
            questions: generatedQuestions,
            userAnswers: {},
            paletteStates,
            startedAt: new Date().toISOString()
        };

        return session;
    }

    evaluateSubmission(session, timeTakenSeconds) {
        if (!session || !session.questions) {
            return { error: 'Invalid test session.' };
        }

        const questions = session.questions;
        const userAnswers = session.userAnswers || {};
        const negativeRate = session.negativeMarkingRate || 0;

        let grossScore = 0;
        let correctCount = 0;
        let wrongCount = 0;
        let unattemptedCount = 0;
        let maxScore = 0;

        const detailedReview = [];

        questions.forEach((q, idx) => {
            const marks = q.marks || 1;
            maxScore += marks;

            const userAnsIdx = userAnswers[q.id];

            let status = 'unattempted';
            let isCorrect = false;

            if (userAnsIdx !== undefined && userAnsIdx !== null) {
                if (userAnsIdx === q.correctIndex) {
                    status = 'correct';
                    isCorrect = true;
                    correctCount++;
                    grossScore += marks;
                } else {
                    status = 'wrong';
                    wrongCount++;
                }
            } else {
                unattemptedCount++;
            }

            detailedReview.push({
                questionNumber: idx + 1,
                id: q.id,
                sectionName: q.subject || 'General Section',
                text: q.text,
                options: q.options,
                userAnswerIndex: userAnsIdx !== undefined ? userAnsIdx : null,
                correctIndex: q.correctIndex,
                isCorrect,
                status,
                marks,
                explanation: q.explanation || `Correct answer is option ${['A','B','C','D'][q.correctIndex]}`
            });
        });

        const negativeDeduction = wrongCount * negativeRate;
        const netScore = Math.max(0, grossScore - negativeDeduction);
        const percentage = parseFloat(((netScore / (maxScore || 1)) * 100).toFixed(1));
        const totalAttempted = correctCount + wrongCount;
        const accuracy = totalAttempted > 0 ? parseFloat(((correctCount / totalAttempted) * 100).toFixed(1)) : 0;
        const passed = percentage >= 40;

        const currentUser = storageService.getCurrentUser();

        const result = {
            id: 'SUB-' + Date.now().toString(36).toUpperCase(),
            sessionId: session.id,
            studentId: session.studentId,
            studentName: session.studentName || currentUser?.name || 'Student User',
            studentEmail: session.studentEmail || currentUser?.email || 'student@sigma.com',
            examId: session.examId,
            examName: session.examName,
            examCode: session.examCode,
            totalQuestions: questions.length,
            totalMarks: maxScore,
            attemptedCount: totalAttempted,
            unattemptedCount,
            correctCount,
            wrongCount,
            grossScore,
            negativeDeduction: parseFloat(negativeDeduction.toFixed(2)),
            finalScore: parseFloat(netScore.toFixed(2)),
            percentage,
            accuracy,
            passed,
            timeTakenSeconds: timeTakenSeconds || (session.durationMinutes * 60),
            submittedAt: new Date().toISOString(),
            detailedReview
        };

        return result;
    }
}

export const examEngine = new ExamEngine();
export const generateExamPaper = (studentId, examId, subjectFilter, count, studentInfo) => 
    examEngine.generatePracticeTest(studentId, examId, subjectFilter, count, studentInfo);
export const evaluateSubmission = (session, timeTakenSeconds) => 
    examEngine.evaluateSubmission(session, timeTakenSeconds);
