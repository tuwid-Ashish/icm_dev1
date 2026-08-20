import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { parseCSVQuestions } from '../src/services/csvParserService.js';

const csvPath = path.resolve(process.cwd(), 'master_questions.csv');
const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');

if (!fs.existsSync(csvPath)) {
    console.error('❌ master_questions.csv not found!');
    process.exit(1);
}

if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found!');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

if (getApps().length === 0) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();

async function importMasterCSV() {
    console.log('🚀 Importing `master_questions.csv` into Cloud Firestore...');
    const rawCsv = fs.readFileSync(csvPath, 'utf-8');
    const questions = parseCSVQuestions(rawCsv);

    console.log(`   • Parsed ${questions.length} questions from CSV.`);

    let count = 0;
    for (const q of questions) {
        const docData = {
            ...q,
            updatedAt: new Date().toISOString()
        };
        await db.collection('questions').doc(q.id).set(docData, { merge: true });
        count++;
        console.log(`   ✓ Imported [${count}/${questions.length}] questions/${q.id}`);
    }

    console.log(`\n🎉 Successfully imported all ${count} questions into Cloud Firestore!`);
    process.exit(0);
}

importMasterCSV().catch(err => {
    console.error('❌ Error importing master CSV:', err);
    process.exit(1);
});
