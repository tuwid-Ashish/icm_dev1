/**
 * CEP Online Mock Test Platform - Exam & Paper Generation Engine
 * Supports Full Mock Papers and Random Subject Practice papers with Fisher-Yates Randomization.
 */

import { firestoreEngine } from './firestoreEngine.js';
import { storageService } from './storageService.js';
import { getExamAccess } from '../utils/examAccess.js';

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

    async generatePracticeTest(studentId, examId, subjectFilter = 'ALL', count = 20, studentInfo = {}) {
        const exams = await firestoreEngine.getExams();
        const exam = exams.find(e => e.id === examId);
        if (!exam) {
            return { error: 'Invalid exam selected.' };
        }

        // Engine-side Paywall & Quota Verification — this is the actual gate
        // before a paper is generated, not just a UI display check, so it
        // has to be exam-scoped: a purchase for one exam must not let a
        // student start a *different* paid exam just because remainingTests
        // (a pooled counter) happens to be > 0.
        const currentUser = await firestoreEngine.getUserProfile(studentId) || storageService.getCurrentUser();
        const access = getExamAccess(currentUser, exam);

        if (!access.unlocked) {
            const message = access.reason === 'quota_exhausted'
                ? 'Insufficient test quota remaining. Please purchase a course package to launch mock tests.'
                : `This exam requires the "${access.requiredExamName || exam.name}" package. Please purchase it to launch mock tests.`;
            return { error: message };
        }

        const allQuestions = await firestoreEngine.getQuestions();
        const examNameLower = (exam.name || '').toLowerCase();
        const examIdLower = (exam.id || '').toLowerCase();

        // 1. Filter Questions for the target Exam Batch
        let batchQuestions = allQuestions.filter(q => {
            if (Array.isArray(q.batches)) {
                if (q.batches.includes('ALL') || q.batches.includes('All Batches')) return true;
                if (q.batches.some(b => {
                    const bl = String(b).toLowerCase();
                    return examNameLower.includes(bl) || bl.includes(examIdLower);
                })) return true;
            }
            if (q.batch) {
                const bStr = String(q.batch).toLowerCase();
                if (bStr.includes('all')) return true;
                if (examNameLower.includes('police') && bStr.includes('police')) return true;
                if ((examNameLower.includes('vanrakshak') || examNameLower.includes('forest')) && (bStr.includes('vanrakshak') || bStr.includes('forest'))) return true;
                if (examNameLower.includes('ssc') && bStr.includes('ssc')) return true;
                if (bStr.includes(examIdLower)) return true;
            }
            return true;
        });

        if (batchQuestions.length === 0) {
            batchQuestions = allQuestions;
        }

        // 2. Filter Questions for the target Subject if specified (e.g. Mathematics)
        if (subjectFilter && subjectFilter !== 'ALL') {
            const sfLower = subjectFilter.toLowerCase();
            const matched = batchQuestions.filter(q => {
                const qSub = (q.subject || '').toLowerCase();
                if (qSub === sfLower || qSub.includes(sfLower) || sfLower.includes(qSub)) return true;

                const isMathFilter = sfLower.includes('math') || sfLower.includes('अंकगणित') || sfLower.includes('गणित');
                const isMathQ = qSub.includes('math') || qSub.includes('अंकगणित') || qSub.includes('गणित');
                if (isMathFilter && isMathQ) return true;

                const isReasoningFilter = sfLower.includes('reasoning') || sfLower.includes('intel') || sfLower.includes('बुद्धिमत्ता');
                const isReasoningQ = qSub.includes('reasoning') || qSub.includes('intel') || qSub.includes('बुद्धिमत्ता');
                if (isReasoningFilter && isReasoningQ) return true;

                const isGkFilter = sfLower.includes('gk') || sfLower.includes('general') || sfLower.includes('सामान्य');
                const isGkQ = qSub.includes('gk') || qSub.includes('general') || qSub.includes('सामान्य');
                if (isGkFilter && isGkQ) return true;

                const isLangFilter = sfLower.includes('marathi') || sfLower.includes('english') || sfLower.includes('मराठी');
                const isLangQ = qSub.includes('marathi') || qSub.includes('english') || qSub.includes('मराठी');
                if (isLangFilter && isLangQ) return true;

                return false;
            });
            batchQuestions = matched;
        }

        if (batchQuestions.length === 0) {
            return { error: `No question paper items found for selected subject "${subjectFilter}". Please select All Subjects or add questions in Question Bank.` };
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
            isFreeTest: !!exam.isFreeTest,
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
                imageUrl: q.imageUrl || null,
                questionImages: q.questionImages || [],
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
