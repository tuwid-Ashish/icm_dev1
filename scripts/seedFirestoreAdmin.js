import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SEED_QUESTIONS } from '../src/data/seedQuestions.js';

// Read .env file for fallback
const envPath = path.resolve(process.cwd(), '.env');
const envVars = {};

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, ...vals] = trimmed.split('=');
            let val = vals.join('=').trim().replace(/^["']|["']$/g, '');
            envVars[key.trim()] = val;
        }
    });
}

const projectId = envVars.VITE_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'competitive-tester';
const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');

console.log('🚀 Initializing Firebase Admin SDK...');
console.log('   • Project ID:', projectId);

let db = null;

try {
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
        if (getApps().length === 0) {
            initializeApp({
                credential: cert(serviceAccount)
            });
        }
        db = getFirestore();
        console.log('🔑 Authenticated with Service Account key file: serviceAccountKey.json');
    } else {
        if (getApps().length === 0) {
            initializeApp({ projectId });
        }
        db = getFirestore();
        console.log('⚡ Initialized with Project ID:', projectId);
    }
} catch (err) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', err.message);
}

const SEED_EXAMS = [
    {
        id: 'police_bharti',
        code: 'PB',
        name: 'Maharashtra Police Bharti (Police Constable)',
        description: 'Written Examination pattern for Police Constable recruitment in Maharashtra.',
        totalMarks: 100,
        totalQuestions: 100,
        durationMinutes: 90,
        negativeMarkingRate: 0,
        medium: 'Marathi (General English section only in English)',
        minQualifyingPercent: 40,
        subjects: [
            { id: 'maths', name: 'Mathematics', questionsCount: 25, marksPerQuestion: 1 },
            { id: 'gk', name: 'General Knowledge & Current Affairs', questionsCount: 25, marksPerQuestion: 1 },
            { id: 'marathi', name: 'Marathi Grammar', questionsCount: 25, marksPerQuestion: 1 },
            { id: 'reasoning', name: 'Intelligence Test / Reasoning', questionsCount: 25, marksPerQuestion: 1 }
        ]
    },
    {
        id: 'vanrakshak',
        code: 'VR',
        name: 'Maharashtra Vanrakshak (Forest Guard) Bharti',
        description: 'TCS iON CBT Exam pattern for Forest Guard recruitment in Maharashtra.',
        totalMarks: 120,
        totalQuestions: 60,
        durationMinutes: 90,
        negativeMarkingRate: 0.5,
        medium: 'Marathi & English (Bilingual)',
        minQualifyingPercent: 45,
        subjects: [
            { id: 'marathi', name: 'Marathi', questionsCount: 15, marksPerQuestion: 2 },
            { id: 'english', name: 'English', questionsCount: 15, marksPerQuestion: 2 },
            { id: 'gk', name: 'General Knowledge', questionsCount: 15, marksPerQuestion: 2 },
            { id: 'reasoning', name: 'Intelligence Test', questionsCount: 15, marksPerQuestion: 2 }
        ]
    },
    {
        id: 'ssc_gd',
        code: 'GD',
        name: 'SSC GD Constable',
        description: 'Staff Selection Commission General Duty Constable Computer Based Test.',
        totalMarks: 160,
        totalQuestions: 80,
        durationMinutes: 60,
        negativeMarkingRate: 0.25,
        medium: 'English, Hindi + 13 Regional Languages',
        minQualifyingPercent: 35,
        subjects: [
            { id: 'reasoning', name: 'General Intelligence & Reasoning', questionsCount: 20, marksPerQuestion: 2 },
            { id: 'gk', name: 'General Knowledge & General Awareness', questionsCount: 20, marksPerQuestion: 2 },
            { id: 'maths', name: 'Elementary Mathematics', questionsCount: 20, marksPerQuestion: 2 },
            { id: 'english_hindi', name: 'English/Hindi', questionsCount: 20, marksPerQuestion: 2 }
        ]
    }
];

async function seed() {
    if (!db) {
        console.error('Cannot proceed without Firestore instance.');
        process.exit(1);
    }

    try {
        console.log('📦 Seeding Exam Blueprints into Firestore collection: `exams`...');
        for (const exam of SEED_EXAMS) {
            await db.collection('exams').doc(exam.id).set(exam);
            console.log(`  ✓ Seeded exam: ${exam.name}`);
        }

        console.log('📚 Seeding Questions into Firestore collection: `questions`...');
        let qCount = 0;
        for (const q of SEED_QUESTIONS) {
            await db.collection('questions').doc(q.id).set(q);
            qCount++;
        }
        console.log(`  ✓ Seeded ${qCount} questions into Cloud Firestore!`);

        console.log('\n🎉 Firebase Admin SDK Seeding completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Admin SDK Seeding Error:', err.message);
        if (err.message.includes('Could not load the default credentials') || err.message.includes('PERMISSION_DENIED')) {
            console.log('\n💡 OFFICIAL FIREBASE INSTRUCTIONS TO AUTHENTICATE ADMIN SDK:');
            console.log('1. Open Firebase Console: https://console.firebase.google.com/');
            console.log('2. Select project "competitive-tester" -> Click Project Settings (⚙️ icon).');
            console.log('3. Go to the "Service accounts" tab.');
            console.log('4. Click "Generate new private key" to download the JSON file.');
            console.log('5. Save the downloaded JSON file into this project folder as:');
            console.log('   d:/icm_dev1/serviceAccountKey.json');
            console.log('6. Re-run `npm run seed:admin`!\n');
        }
        process.exit(1);
    }
}

seed();
