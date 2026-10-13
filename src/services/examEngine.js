/**
 * CEP Online Mock Test Platform - Exam & Paper Generation Engine
 * Supports Full Mock Papers and Random Subject Practice papers with Fisher-Yates Randomization.
 */

import { firestoreEngine } from './firestoreEngine.js';
import { storageService } from './storageService.js';
import { getExamAccess } from '../utils/examAccess.js';
import { EXAM_ID_TO_BATCH } from '../constants/examBatches.js';
import { resolveSubjectCode } from '../constants/subjectCodes.js';
import { indexKey } from '../utils/questionIndex.js';

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
     * Does this question belong to this blueprint section? Subject code
     * equality, and nothing else.
     *
     * This used to end in a substring fallback:
     *     qSub === bpSub || qSub.includes(bpSub) || bpSub.includes(qSub)
     * which existed only because the blueprint stored free text ("General
     * Knowledge & Current Affairs") that had to be reconciled with a coded
     * question. Blueprints store `subjectCode` now, so the reconciliation is
     * unnecessary — and the substring rule was a standing hazard: a subject
     * named "GK" would have matched both "GK 1" and "GK 2", quietly pooling
     * two sections together.
     *
     * Verified safe by scripts/compareSubjectMatching.js: on the live bank the
     * strict rule produces an identical pool for all 9 codes.
     *
     * `subjectFilter` from the student UI is also a code — see the subject
     * pickers in ExamCatalogPage / FreeTestsPage.
     */
    isQuestionMatchingSubject(q, blueprintSubjectCode) {
        if (!q || !blueprintSubjectCode) return false;
        return String(q.subjectCode || '').trim().toUpperCase()
            === String(blueprintSubjectCode).trim().toUpperCase();
    }

    /**
     * The batch rule: when an exam names a question batch, a question counts
     * only if it is tagged for all batches or for that one. (Every question in
     * the bank is currently tagged for all batches, so this excludes nothing;
     * it is kept so tagging questions per batch would still work.)
     */
    questionInBatch(q, targetBatch) {
        if (!targetBatch) return true;
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
    }

    /**
     * Chooses `wanted` random questions from a list of question ids by fetching
     * ONLY the chosen ones, instead of reading the whole bank to pick from it.
     *
     * Asks for a few more than needed so an index entry that has gone stale (a
     * question whose subject was changed, or that no longer exists) is replaced
     * without a second round trip; if still short, it takes the next ids.
     */
    async pickFromIds(ids, wanted, { subjectCode = null, targetBatch = null } = {}) {
        const remaining = this.fisherYatesShuffle(ids);
        const picked = [];
        let cursor = 0;
        while (picked.length < wanted && cursor < remaining.length) {
            const need = wanted - picked.length;
            const take = Math.min(remaining.length - cursor, need + Math.max(2, Math.ceil(need * 0.1)));
            const chunk = remaining.slice(cursor, cursor + take);
            cursor += take;
            const docs = await firestoreEngine.getQuestionsByIds(chunk);
            docs.forEach(q => {
                if (subjectCode && !this.isQuestionMatchingSubject(q, subjectCode)) return;
                if (!this.questionInBatch(q, targetBatch)) return;
                picked.push(q);
            });
        }
        return this.fisherYatesShuffle(picked).slice(0, wanted);
    }

    /**
     * Builds the paper from the question index: reads the few index documents it
     * needs (about one per subject), then fetches only the questions chosen.
     * About 120 reads for a 100-question paper, whatever the size of the bank.
     * Same selection rules as the full-bank path below.
     */
    async buildFromIndex({ exam, subjectFilter, count, blueprintSubjects, targetBatch }) {
        const shortfalls = [];
        let generatedQuestions = [];

        if (subjectFilter === 'ALL' && blueprintSubjects) {
            const totalBlueprintQuestions = blueprintSubjects.reduce((sum, s) => sum + (parseInt(s.questionsCount, 10) || 0), 0);
            const targetTotalCount = exam.totalQuestions || totalBlueprintQuestions || 20;
            const scaleRatio = totalBlueprintQuestions > 0 ? (targetTotalCount / totalBlueprintQuestions) : 1;

            const index = await firestoreEngine.getQuestionIndexForSubjects(blueprintSubjects.map(s => s.subjectCode || s.name));
            const sections = await Promise.all(blueprintSubjects.map(async (s) => {
                const blueprintCode = s.subjectCode || s.name;
                const wantedCount = Math.max(1, Math.round((parseInt(s.questionsCount, 10) || 1) * scaleRatio));
                const sectionLabel = resolveSubjectCode(blueprintCode).name || blueprintCode;
                const picked = await this.pickFromIds(index[indexKey(blueprintCode)] || [], wantedCount, { subjectCode: blueprintCode, targetBatch });

                // The bank could not fill this section; record it rather than hide it.
                if (picked.length < wantedCount) {
                    shortfalls.push({ subjectCode: blueprintCode, subjectName: sectionLabel, wanted: wantedCount, available: picked.length });
                }
                return picked.map(q => ({
                    ...q,
                    sectionId: blueprintCode,
                    sectionName: sectionLabel,
                    marks: s.marksPerQuestion || q.marks || 1
                }));
            }));
            generatedQuestions = sections.flat();
        } else if (subjectFilter !== 'ALL') {
            const index = await firestoreEngine.getQuestionIndexForSubjects([subjectFilter]);
            const targetCount = exam.totalQuestions || parseInt(count, 10) || 20;
            const resolvedSub = resolveSubjectCode(subjectFilter);
            const picked = await this.pickFromIds(index[indexKey(subjectFilter)] || [], targetCount, { subjectCode: subjectFilter, targetBatch });
            generatedQuestions = picked.map(q => ({
                ...q,
                sectionId: resolvedSub.code,
                sectionName: resolvedSub.name,
                marks: q.marks || 1
            }));
        } else {
            const all = await firestoreEngine.getAllQuestionIndex();
            generatedQuestions = await this.pickFromIds(Object.values(all).flat(), exam.totalQuestions || 20, { targetBatch });
        }

        return { generatedQuestions, shortfalls };
    }

    /**
     * Tries the index. Returns null — and the caller reads the whole bank, as it
     * always did — when the index is not built yet or cannot be read, so the
     * index can only ever make a paper cheaper, never prevent one.
     */
    async tryBuildFromIndex(args) {
        try {
            const meta = await firestoreEngine.getQuestionIndexMeta();
            if (!meta || !meta.built) return null;
            return await this.buildFromIndex(args);
        } catch (err) {
            console.warn('[ExamEngine] Question index unavailable, reading the whole bank instead:', err.message);
            return null;
        }
    }

    async generatePracticeTest(studentId, examId, subjectFilter = 'ALL', count = 20, studentInfo = {}) {
        const exam = await firestoreEngine.getExamById(examId);
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

        let generatedQuestions = [];
        // Sections the question bank could not fill. Reported on the session
        // rather than thrown, so a thin paper still runs but is never silent.
        const shortfalls = [];

        const targetBatch = exam.questionBatch || EXAM_ID_TO_BATCH[exam.id];
        // Blueprint-driven: strictly obeys the exam blueprint set in the admin
        // section (exam.subjects), so subjects not in it are left out.
        const blueprintSubjects = exam.subjects && Array.isArray(exam.subjects) && exam.subjects.length > 0
            ? exam.subjects
            : null;

        // Fast path: pick ids from the question index and fetch only the chosen
        // questions (~120 reads). Falls through to the full-bank read below when
        // the index is not built or cannot be read.
        const indexed = await this.tryBuildFromIndex({ exam, subjectFilter, count, blueprintSubjects, targetBatch });

        if (indexed) {
            generatedQuestions = indexed.generatedQuestions;
            shortfalls.push(...indexed.shortfalls);
        } else {
        const allQuestions = await firestoreEngine.getQuestions();

        // 1. Filter Questions for the target Exam Batch
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

        // 2. Blueprint-driven subject selection (full-bank path)
        if (subjectFilter === 'ALL' && blueprintSubjects) {
            const totalBlueprintQuestions = blueprintSubjects.reduce((sum, s) => sum + (parseInt(s.questionsCount, 10) || 0), 0);
            // No hard ceiling. This was Math.min(..., 100), which did not just
            // cap the total — it fed scaleRatio below, silently shrinking every
            // section in proportion. An exam configured for 120 (4 x 30) served
            // 100 as 4 x 25, with nothing anywhere saying so. The admin's
            // configured total is authoritative.
            const targetTotalCount = exam.totalQuestions || totalBlueprintQuestions || 20;
            const scaleRatio = totalBlueprintQuestions > 0 ? (targetTotalCount / totalBlueprintQuestions) : 1;

            blueprintSubjects.forEach(s => {
                // `s.name` is the pre-migration field, which held the code too —
                // read it as a fallback so an unmigrated blueprint still works.
                // See scripts/migrateBlueprintSubjectCodes.js.
                const blueprintCode = s.subjectCode || s.name;
                const wantedCount = Math.max(1, Math.round((parseInt(s.questionsCount, 10) || 1) * scaleRatio));
                const subjPool = batchQuestions.filter(q => this.isQuestionMatchingSubject(q, blueprintCode));
                const shuffledSubjPool = this.fisherYatesShuffle(subjPool);

                const sectionLabel = resolveSubjectCode(blueprintCode).name || blueprintCode;
                const takeCount = Math.min(wantedCount, shuffledSubjPool.length);

                // The blueprint asked for more questions than this subject has.
                // Previously the Math.min above just took whatever existed and
                // moved on, and the only guard was "did the WHOLE paper come
                // back empty" — so a 100-question exam could ship 58 with no
                // indication anywhere. Record it so callers can report it.
                if (takeCount < wantedCount) {
                    shortfalls.push({
                        subjectCode: blueprintCode,
                        subjectName: sectionLabel,
                        wanted: wantedCount,
                        available: shuffledSubjPool.length
                    });
                }

                const picked = shuffledSubjPool.slice(0, takeCount).map(q => ({
                    ...q,
                    sectionId: blueprintCode,
                    sectionName: sectionLabel,
                    marks: s.marksPerQuestion || q.marks || 1
                }));

                generatedQuestions.push(...picked);
            });
        } else if (subjectFilter !== 'ALL') {
            // subjectFilter is a subject CODE. It used to be lower-cased here
            // because the match was a case-insensitive substring test; it is a
            // code comparison now, so pass it through untouched.
            const matched = batchQuestions.filter(q => this.isQuestionMatchingSubject(q, subjectFilter));
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
        } // end of full-bank fallback

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
            // 'full' = the exam's own blueprint paper; 'subject' = a one-subject
            // practice drill. Only full papers count towards ranking.
            paperType: subjectFilter !== 'ALL' ? 'subject' : 'full',
            examName: subjectFilter !== 'ALL' ? `${exam.name} (${resolvedSubjectDisplay} Practice)` : exam.name,
            examCode: exam.code,
            durationMinutes: subjectFilter !== 'ALL' ? Math.max(10, Math.ceil(generatedQuestions.length * 1.0)) : exam.durationMinutes,
            negativeMarkingRate: exam.negativeMarkingRate,
            // What the blueprint asked for vs what the bank could supply.
            // requestedQuestions is only meaningful for a full blueprint paper;
            // single-subject practice is sized by what exists by design.
            requestedQuestions: subjectFilter === 'ALL' ? (exam.totalQuestions || generatedQuestions.length) : generatedQuestions.length,
            shortfalls,
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
            // Derived from the session, not the clock: a second submit of the
            // same session (timer auto-submit racing the button) then produces
            // the same id, and the server saves it once instead of twice.
            id: session.id ? 'SUB-' + String(session.id).replace(/^SESSION-/, '') : 'SUB-' + Date.now().toString(36).toUpperCase(),
            paperType: session.paperType || (/practice/i.test(session.examName || '') ? 'subject' : 'full'),
            isFreeTest: !!session.isFreeTest,
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
