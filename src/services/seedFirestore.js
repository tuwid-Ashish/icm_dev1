/**
 * CEP Online Mock Test Platform - Cloud Firestore Seeding Service
 * Bulk uploads 60 Marathi/English questions and 3 exam blueprints to Cloud Firestore.
 */

import { db, collection, addDoc, setDoc, doc, isFirebaseConnected } from './firebase.js';
import { SEED_QUESTIONS } from '../data/seedQuestions.js';
import { storageService } from './storageService.js';

export async function seedFirestoreData() {
    if (!isFirebaseConnected || !db) {
        return { 
            success: false, 
            message: 'Firebase is not connected. Please populate .env with credentials first.' 
        };
    }

    try {
        let questionsCount = 0;
        let examsCount = 0;

        // 1. Seed Exams
        const exams = storageService.getExams();
        for (const exam of exams) {
            await setDoc(doc(db, 'exams', exam.id), exam);
            examsCount++;
        }

        // 2. Seed Questions
        for (const q of SEED_QUESTIONS) {
            await addDoc(collection(db, 'questions'), q);
            questionsCount++;
        }

        console.log(`[Firestore Seeder] Successfully seeded ${examsCount} exams and ${questionsCount} questions.`);
        return {
            success: true,
            message: `Successfully seeded Cloud Firestore with ${examsCount} exam blueprints and ${questionsCount} questions.`
        };
    } catch (err) {
        console.error('[Firestore Seeder] Error seeding database:', err);
        return {
            success: false,
            message: `Error seeding Firestore: ${err.message}`
        };
    }
}
