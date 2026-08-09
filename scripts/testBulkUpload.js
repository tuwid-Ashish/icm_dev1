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

function parseCsvFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const questions = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        if (parts && parts.length >= 8) {
            const clean = parts.map(p => p.replace(/^"|"$/g, '').trim());
            questions.push({
                id: clean[0],
                batch: clean[1],
                subject: clean[2],
                text: clean[3],
                options: [clean[4], clean[5], clean[6], clean[7]],
                correctIndex: parseInt(clean[8], 10) || 0,
                marks: parseFloat(clean[9]) || 1,
                explanation: clean[10] || ''
            });
        }
    }
    return questions;
}

async function bulkUploadAll() {
    console.log('🚀 Parsing and uploading sample bulk CSV files to Cloud Firestore...\n');

    const files = [
        'sample_bulk_police_bharti.csv',
        'sample_bulk_vanrakshak.csv',
        'sample_bulk_ssc_gd.csv'
    ];

    let totalUploaded = 0;

    for (const f of files) {
        const fullPath = path.resolve(process.cwd(), f);
        if (fs.existsSync(fullPath)) {
            const qList = parseCsvFile(fullPath);
            console.log(`📄 ${f}: Found ${qList.length} questions.`);
            for (const q of qList) {
                await db.collection('questions').doc(q.id).set(q, { merge: true });
                totalUploaded++;
            }
            console.log(`  ✓ Uploaded ${qList.length} questions from ${f}`);
        }
    }

    console.log(`\n🎉 Success! Inserted ${totalUploaded} bulk questions into Cloud Firestore!\n`);
    process.exit(0);
}

bulkUploadAll();
