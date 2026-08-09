import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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

let adminApp;
if (getApps().length === 0) {
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
        adminApp = initializeApp({ credential: cert(serviceAccount) });
        console.log('🔑 Authenticated with Service Account key file.');
    } else {
        adminApp = initializeApp({ projectId });
        console.log('⚡ Initialized with Project ID:', projectId);
    }
} else {
    adminApp = getApps()[0];
}

const auth = getAuth(adminApp);
const db = getFirestore(adminApp);

async function createAdmin() {
    const adminEmail = process.argv[2] || 'admin@sigma.com';
    const adminPassword = process.argv[3] || 'admin123';
    const adminName = process.argv[4] || 'System Administrator';

    console.log(`\n👑 Creating Admin Account:`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Name:  ${adminName}\n`);

    try {
        let uid;
        try {
            // Check if user already exists in Firebase Auth
            const existingUser = await auth.getUserByEmail(adminEmail);
            uid = existingUser.uid;
            console.log(`  ✓ Found existing Firebase Auth user: ${uid}`);
        } catch (e) {
            // Create user in Firebase Auth
            const newUser = await auth.createUser({
                email: adminEmail,
                password: adminPassword,
                displayName: adminName
            });
            uid = newUser.uid;
            console.log(`  ✓ Created new Firebase Auth user: ${uid}`);
        }

        // Create/Update Admin Profile Document in Cloud Firestore (users/{uid})
        const adminProfile = {
            uid,
            id: uid,
            name: adminName,
            email: adminEmail,
            role: 'admin',
            status: 'active',
            createdAt: new Date().toISOString()
        };

        await db.collection('users').doc(uid).set(adminProfile, { merge: true });
        console.log(`  ✓ Created Cloud Firestore admin profile document in users/${uid}`);

        console.log(`\n🎉 Admin Account setup completed successfully!`);
        console.log(`   You can now log in at http://localhost:3000/admin with:`);
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${adminPassword}\n`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to create Admin account:', err.message);
        if (err.message.includes('Could not load the default credentials')) {
            console.log('\n💡 TIP: Download serviceAccountKey.json from Firebase Console -> Project Settings -> Service accounts, save it to d:/icm_dev1/serviceAccountKey.json, and re-run this script!\n');
        }
        process.exit(1);
    }
}

createAdmin();
