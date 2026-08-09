import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

let adminApp;
if (getApps().length === 0) {
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
        adminApp = initializeApp({ credential: cert(serviceAccount) });
    } else {
        adminApp = initializeApp({ projectId });
    }
} else {
    adminApp = getApps()[0];
}

const db = getFirestore(adminApp);

async function verifyCloudFirestoreQuestions() {
    console.log('🔍 Querying Cloud Firestore "questions" collection...\n');

    try {
        const snapshot = await db.collection('questions').get();
        console.log(`📊 Total Question Documents Found in Firestore: ${snapshot.size}\n`);

        const policeBhartiQs = [];
        const vanrakshakQs = [];
        const sscGdQs = [];
        const otherQs = [];

        snapshot.forEach(doc => {
            const q = doc.data();
            const batch = q.batch || '';
            if (batch.includes('Police')) policeBhartiQs.push(q);
            else if (batch.includes('Vanrakshak') || batch.includes('Forest')) vanrakshakQs.push(q);
            else if (batch.includes('SSC')) sscGdQs.push(q);
            else otherQs.push(q);
        });

        console.log(`🚓 Police Bharti Questions Count: ${policeBhartiQs.length}`);
        console.log(`🌲 Vanrakshak (Forest Guard) Questions Count: ${vanrakshakQs.length}`);
        console.log(`🎖️ SSC GD Constable Questions Count: ${sscGdQs.length}`);
        console.log(`📋 Other Questions Count: ${otherQs.length}\n`);

        console.log('--- Sample Police Bharti Questions in Cloud Firestore ---');
        policeBhartiQs.slice(0, 5).forEach((q, idx) => {
            console.log(`[${idx + 1}] ID: ${q.id} | Subject: ${q.subject}`);
            console.log(`    Text: "${q.text}"`);
            console.log(`    Correct Answer Index: ${q.correctIndex} (${q.options ? q.options[q.correctIndex] : ''})`);
            console.log(`    Explanation: "${q.explanation}"\n`);
        });

        console.log('✅ Cloud Firestore Verification Complete!');
        process.exit(0);

    } catch (err) {
        console.error('❌ Verification error:', err.message);
        process.exit(1);
    }
}

verifyCloudFirestoreQuestions();
