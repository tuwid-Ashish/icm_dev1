import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Read .env file and strip any quotes
const envPath = path.resolve(process.cwd(), '.env');
const envVars = {};

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, ...vals] = trimmed.split('=');
            let val = vals.join('=').trim();
            // Clean quotes if present
            val = val.replace(/^["']|["']$/g, '');
            envVars[key.trim()] = val;
        }
    });
}

const firebaseConfig = {
    apiKey: envVars.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: envVars.VITE_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: envVars.VITE_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID
};

console.log('🚀 Initializing Firebase with Cleaned Config:');
console.log('   • Project ID:', firebaseConfig.projectId);
console.log('   • Auth Domain:', firebaseConfig.authDomain);
console.log('   • API Key Starts With:', firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 6) + '...' : 'MISSING');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Seed Questions & Exams Data
import { SEED_QUESTIONS } from '../src/data/seedQuestions.js';

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
    try {
        console.log('📦 Seeding Exam Blueprints into Firestore collection: `exams`...');
        for (const exam of SEED_EXAMS) {
            await setDoc(doc(db, 'exams', exam.id), exam);
            console.log(`  ✓ Seeded exam: ${exam.name}`);
        }

        console.log('📚 Seeding Questions into Firestore collection: `questions`...');
        let qCount = 0;
        for (const q of SEED_QUESTIONS) {
            await setDoc(doc(db, 'questions', q.id), q);
            qCount++;
        }
        console.log(`  ✓ Seeded ${qCount} questions into Firestore.`);

        console.log('🎉 Cloud Firestore seeding completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error seeding Cloud Firestore:', err);
        process.exit(1);
    }
}

seed();
