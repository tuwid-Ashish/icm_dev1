/**
 * CEP Online Mock Test Platform - Core Exam & Test Generator Engine
 * Handles randomized test generation, section allocation, timer tracking, negative marking, and evaluation.
 */

import { storage } from './storage.js';

export class ExamEngine {
    /**
     * Generate a new practice test session for a student based on an exam blueprint.
     */
    generatePracticeTest(studentId, examId, mode = 'full') {
        const student = storage.getStudentById(studentId);
        if (!student) {
            return { error: 'Student account not found.' };
        }

        // Business Rule: Check practice test balance
        if (student.remainingTests <= 0) {
            return { 
                error: 'Test balance exhausted. You have 0 remaining practice tests. Please contact your Administrator to increase your limit.',
                limitReached: true
            };
        }

        const exam = storage.getExamById(examId);
        if (!exam) {
            return { error: 'Invalid exam selected.' };
        }

        const allQuestions = storage.getQuestions();
        const generatedQuestions = [];
        const examBatchName = exam.name.includes('Police') ? 'Police Bharti' :
                            exam.name.includes('Forest') || exam.name.includes('Vanrakshak') ? 'Vanrakshak' :
                            exam.name.includes('SSC') ? 'SSC GD' : '';

        // Filter questions available for this exam batch
        let batchQuestions = allQuestions.filter(q => 
            q.batch === examBatchName || 
            q.batch.toLowerCase().includes(exam.id) ||
            examBatchName.toLowerCase().includes(q.batch.toLowerCase())
        );

        // Fallback: If pool is empty or small, use all questions matching subject tags
        if (batchQuestions.length === 0) {
            batchQuestions = [...allQuestions];
        }

        // Shuffle helper (Fisher-Yates)
        const shuffle = (array) => {
            const arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        };

        const isQuestionMatchingSubject = (q, bpSubjectName) => {
            if (!q || !bpSubjectName) return false;
            
            const bpResolved = resolveSubjectCode(bpSubjectName);
            const qResolved = resolveSubjectCode(q.subjectCode || q.subject);

            // 1. Direct Subject Code Matching (e.g. 'M1' === 'M1')
            if (bpResolved.code !== 'OTHER' && qResolved.code !== 'OTHER' && bpResolved.code === qResolved.code) {
                return true;
            }

            // 2. Direct Code Comparison (e.g. q.subjectCode === 'M1' or bpSubjectName === 'M1')
            const bpCode = bpSubjectName.trim().toUpperCase();
            const qCode = (q.subjectCode || qResolved.code || '').trim().toUpperCase();
            if (bpCode === qCode && bpCode.startsWith('M')) {
                return true;
            }

            // 3. String & Alias Matching
            const qSub = (q.subject || qResolved.name || '').toLowerCase();
            const bpSub = String(bpSubjectName || '').toLowerCase();

            if (qSub === bpSub || qSub.includes(bpSub) || bpSub.includes(qSub)) return true;

            return false;
        };

        // Select questions strictly per blueprint subject section
        exam.subjects.forEach(subject => {
            const subjectPool = batchQuestions.filter(q => isQuestionMatchingSubject(q, subject.name));
            const shuffledPool = shuffle(subjectPool);
            
            // Scaled selection if full quota exceeds available pool
            const countToPick = Math.min(subject.questionsCount, shuffledPool.length);
            const picked = shuffledPool.slice(0, countToPick).map(q => ({
                ...q,
                sectionId: subject.id || subject.name,
                sectionName: subject.name,
                marks: subject.marksPerQuestion || q.marks || 1
            }));

            generatedQuestions.push(...picked);
        });

        // Ensure unique questions within the test instance
        const uniqueQuestions = [];
        const seenIds = new Set();
        generatedQuestions.forEach(q => {
            if (!seenIds.has(q.id)) {
                seenIds.add(q.id);
                uniqueQuestions.push(q);
            }
        });

        // Calculate actual total marks for this test instance
        const calculatedTotalMarks = uniqueQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);

        // Decrement student test balance
        const updatedStudent = storage.decrementStudentTestBalance(studentId);

        // Create test session payload
        const sessionId = 'TEST-' + Date.now().toString(36).toUpperCase();
        const testSession = {
            id: sessionId,
            studentId,
            studentName: student.name,
            examId: exam.id,
            examName: exam.name,
            examCode: exam.code,
            durationMinutes: exam.durationMinutes,
            durationSeconds: exam.durationMinutes * 60,
            negativeMarkingRate: exam.negativeMarkingRate,
            questions: uniqueQuestions,
            totalQuestions: uniqueQuestions.length,
            totalMarks: calculatedTotalMarks,
            userAnswers: {},       // { questionId: optionIndex (0..3) }
            paletteStates: {},     // { questionId: 'visited' | 'answered' | 'marked' | 'answered_marked' }
            startTime: new Date().toISOString(),
            timeRemainingSeconds: exam.durationMinutes * 60,
            status: 'in-progress'
        };

        // Initialize default palette states (Not Visited)
        uniqueQuestions.forEach((q, idx) => {
            testSession.paletteStates[q.id] = idx === 0 ? 'visited' : 'not_visited';
        });

        storage.saveActiveTestSession(testSession);

        return {
            success: true,
            session: testSession,
            remainingTests: updatedStudent ? updatedStudent.remainingTests : student.remainingTests - 1
        };
    }

    /**
     * Evaluate and submit a test session.
     */
    evaluateSubmission(sessionId, userAnswers = {}, paletteStates = {}, timeTakenSeconds = 0) {
        const session = storage.getActiveTestSession(sessionId);
        let questions = session ? session.questions : [];
        
        if (!session) {
            // Fallback lookup
            return { error: 'Test session not found' };
        }

        const negativeRate = session.negativeMarkingRate || 0;
        let correctCount = 0;
        let wrongCount = 0;
        let unattemptedCount = 0;
        let grossScore = 0;
        let negativeDeduction = 0;

        const detailedReview = questions.map((q, idx) => {
            const userAnswerIdx = userAnswers[q.id] !== undefined && userAnswers[q.id] !== null ? parseInt(userAnswers[q.id], 10) : null;
            const isAttempted = userAnswerIdx !== null;
            const isCorrect = isAttempted && userAnswerIdx === q.correctIndex;
            
            let status = 'unattempted';
            if (isAttempted) {
                if (isCorrect) {
                    status = 'correct';
                    correctCount++;
                    grossScore += (q.marks || 1);
                } else {
                    status = 'wrong';
                    wrongCount++;
                    const penalty = (q.marks || 1) * negativeRate;
                    negativeDeduction += penalty;
                }
            } else {
                unattemptedCount++;
            }

            return {
                questionNumber: idx + 1,
                id: q.id,
                sectionName: q.sectionName,
                text: q.text,
                options: q.options,
                correctIndex: q.correctIndex,
                userAnswerIndex: userAnswerIdx,
                isCorrect,
                status,
                marks: q.marks || 1,
                explanation: q.explanation || `Correct option is ${q.options[q.correctIndex]}`
            };
        });

        const netScore = Math.max(0, grossScore - negativeDeduction);
        const maxScore = session.totalMarks || questions.length;
        const percentage = maxScore > 0 ? parseFloat(((netScore / maxScore) * 100).toFixed(2)) : 0;
        const totalAttempted = correctCount + wrongCount;
        const accuracy = totalAttempted > 0 ? parseFloat(((correctCount / totalAttempted) * 100).toFixed(2)) : 0;
        const passed = percentage >= (session.minQualifyingPercent || 40);

        const result = {
            id: 'SUB-' + Date.now().toString(36).toUpperCase(),
            sessionId: session.id,
            studentId: session.studentId,
            studentName: session.studentName,
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
            timeTakenSeconds: timeTakenSeconds || (session.durationSeconds - (session.timeRemainingSeconds || 0)),
            submittedAt: new Date().toISOString(),
            detailedReview
        };

        // Save submission and clear active session
        storage.saveSubmission(result);
        storage.removeActiveTestSession(sessionId);

        return {
            success: true,
            submission: result
        };
    }
}

export const examEngine = new ExamEngine();
