import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

const firebaseConfig = {
    apiKey: envVars.VITE_FIREBASE_API_KEY,
    authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: envVars.VITE_FIREBASE_PROJECT_ID,
    storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: envVars.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collectionsToInspect = ['users', 'exams', 'questions', 'test_attempts', 'submissions', 'packages', 'package_requests', 'settings'];

async function inspect() {
    console.log('🔍 Inspecting Cloud Firestore Project:', firebaseConfig.projectId);
    for (const colName of collectionsToInspect) {
        try {
            const snap = await getDocs(collection(db, colName));
            console.log(`\n📁 Collection [${colName}]: ${snap.size} documents found.`);
            snap.docs.forEach(d => {
                console.log(`   • ID: ${d.id} =>`, JSON.stringify(d.data()).substring(0, 120) + '...');
            });
        } catch (e) {
            console.log(`   ❌ Collection [${colName}] error:`, e.message);
        }
    }
    process.exit(0);
}

inspect();
