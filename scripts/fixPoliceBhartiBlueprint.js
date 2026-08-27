import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function fixPBBlueprint() {
    console.log('🚀 Correcting Exam Blueprint for `pb` (महाराष्ट्र पोलीस भरती) in Cloud Firestore...');
    
    const correctSubjects = [
        { name: 'M1', questionsCount: 25, marksPerQuestion: 1 },
        { name: 'M2', questionsCount: 25, marksPerQuestion: 1 },
        { name: 'M3', questionsCount: 25, marksPerQuestion: 1 },
        { name: 'M4', questionsCount: 25, marksPerQuestion: 1 }
    ];

    await db.collection('exams').doc('pb').update({
        subjects: correctSubjects,
        totalQuestions: 100,
        totalMarks: 100,
        updatedAt: new Date().toISOString()
    });

    console.log('✅ Exam Blueprint for `pb` updated successfully in Cloud Firestore!');
    console.log('Updated Subjects:', JSON.stringify(correctSubjects, null, 2));

    process.exit(0);
}

fixPBBlueprint().catch(console.error);
