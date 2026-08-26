/**
 * CEP Online Mock Test Platform - Exam & Paper Generation Engine
 * Supports Full Mock Papers and Random Subject Practice papers with Fisher-Yates Randomization.
 */

import { firestoreEngine } from './firestoreEngine.js';
import { storageService } from './storageService.js';
import { getExamAccess } from '../utils/examAccess.js';
import { EXAM_ID_TO_BATCH } from '../constants/examBatches.js';
import { resolveSubjectCode } from '../constants/subjectCodes.js';

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

    /**
     * Matches a question against a blueprint subject using code, name, or canonical aliases.
     */
    isQuestionMatchingSubject(q, bpSubjectName) {
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
    }

    async generatePracticeTest(studentId, examId, subjectFilter = 'ALL', count = 20, studentInfo = {}) {
        const exams = await firestoreEngine.getExams();
        const exam = exams.find(e => e.id === examId);
        if (!exam) {
            return { error: 'Invalid exam selected.' };
        }

        // Engine-side Paywall & Quota Verification
        const currentUser = await firestoreEngine.getUserProfile(studentId) || storageService.getCurrentUser();
        const access = getExamAccess(currentUser, exam);

        if (!access.unlocked) {
            const message = access.reason === 'quota_exhausted'
                ? 'Insufficient test quota remaining. Please purchase a course package to launch mock tests.'
                : `This exam requires the "${access.requiredExamName || exam.name}" package. Please purchase it to launch mock tests.`;
            return { error: message };
        }

        const allQuestions = await firestoreEngine.getQuestions();

        // 1. Filter Questions for the target Exam Batch
        const targetBatch = exam.questionBatch || EXAM_ID_TO_BATCH[exam.id];
        let batchQuestions = targetBatch
            ? allQuestions.filter(q => {
                if (Array.isArray(q.batches)) {
                    if (q.batches.includes('ALL') || q.batches.includes('All Batches')) return true;
                    return q.batches.includes(targetBatch);
                }
                if (q.batch) {
                    const parts = String(q.batch).split(',').map(b => b.trim());
                    if (parts.some(p => p.toLowerCase() === 'all')) return true;
                    return parts.includes(targetBatch);
                }
                return false;
            })
            : allQuestions;

        if (batchQuestions.length === 0) {
            batchQuestions = allQuestions;
        }

        let generatedQuestions = [];

        // 🌟 2. Blueprint-Driven Subject Selection Engine
        // Strictly obeys the Exam Blueprint configuration configured in the Admin Section (exam.subjects).
        // Filters out any unassigned or non-blueprint subjects (e.g. English is excluded for Police Bharti).
        const blueprintSubjects = exam.subjects && Array.isArray(exam.subjects) && exam.subjects.length > 0
            ? exam.subjects
            : null;

        if (subjectFilter === 'ALL' && blueprintSubjects) {
            const totalBlueprintQuestions = blueprintSubjects.reduce((sum, s) => sum + (parseInt(s.questionsCount, 10) || 0), 0);
            const targetTotalCount = Math.min(exam.totalQuestions || totalBlueprintQuestions || 20, 100);
            const scaleRatio = totalBlueprintQuestions > 0 ? (targetTotalCount / totalBlueprintQuestions) : 1;

            blueprintSubjects.forEach(s => {
                const wantedCount = Math.max(1, Math.round((parseInt(s.questionsCount, 10) || 1) * scaleRatio));
                const subjPool = batchQuestions.filter(q => this.isQuestionMatchingSubject(q, s.name));
                const shuffledSubjPool = this.fisherYatesShuffle(subjPool);

                const picked = shuffledSubjPool.slice(0, Math.min(wantedCount, shuffledSubjPool.length)).map(q => ({
                    ...q,
                    sectionId: s.id || s.name,
                    sectionName: s.name,
                    marks: s.marksPerQuestion || q.marks || 1
                }));

                generatedQuestions.push(...picked);
            });
        } else if (subjectFilter !== 'ALL') {
            const sfLower = subjectFilter.toLowerCase();
            const matched = batchQuestions.filter(q => this.isQuestionMatchingSubject(q, sfLower));
            const shuffled = this.fisherYatesShuffle(matched);
            // Single Subject Practice generates full test question count (e.g. 20 questions) for that subject
            const targetCount = exam.totalQuestions || parseInt(count, 10) || 20;
            const selectedCount = Math.min(targetCount, shuffled.length);
            const resolvedSub = resolveSubjectCode(subjectFilter);

            generatedQuestions = shuffled.slice(0, selectedCount).map(q => ({
                ...q,
                sectionId: resolvedSub.code,
                sectionName: resolvedSub.name,
                marks: q.marks || 1
            }));
        } else {
            const shuffled = this.fisherYatesShuffle(batchQuestions);
            const selectedCount = Math.min(exam.totalQuestions || 20, shuffled.length);
            generatedQuestions = shuffled.slice(0, selectedCount);
        }

        if (generatedQuestions.length === 0) {
            return { error: `No question paper items found for selected subject or exam blueprint. Please check Question Bank.` };
        }

        // Deduplicate and ensure no duplicate question IDs
        const uniqueQuestions = [];
        const seenIds = new Set();
        generatedQuestions.forEach(q => {
            if (!seenIds.has(q.id)) {
                seenIds.add(q.id);
                uniqueQuestions.push(q);
            }
        });
        generatedQuestions = uniqueQuestions;

        const paletteStates = {};
        generatedQuestions.forEach(q => {
            paletteStates[q.id] = 'not_visited';
        });

        const resolvedSubjectDisplay = subjectFilter !== 'ALL' ? resolveSubjectCode(subjectFilter).name : '';

        const session = {
            id: 'SESSION-' + Date.now().toString(36).toUpperCase(),
            studentId,
            studentName: studentInfo?.studentName || currentUser?.name || 'Student User',
            studentEmail: studentInfo?.studentEmail || currentUser?.email || 'student@sigma.com',
            examId: exam.id,
            isFreeTest: !!exam.isFreeTest,
            examName: subjectFilter !== 'ALL' ? `${exam.name} (${resolvedSubjectDisplay} Practice)` : exam.name,
            examCode: exam.code,
            durationMinutes: subjectFilter !== 'ALL' ? Math.max(10, Math.ceil(generatedQuestions.length * 1.0)) : exam.durationMinutes,
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
