import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { resolveSubjectCode } from '../src/constants/subjectCodes.js';

const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found!');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function migrateSubjectCodes() {
    console.log('🚀 Migrating all questions in Cloud Firestore to enforce permanent `subjectCode`...');
    const snapshot = await db.collection('questions').get();
    
    console.log(`📊 Found ${snapshot.docs.length} total questions in Firestore.`);

    let updatedCount = 0;
    let totalCount = 0;

    for (const doc of snapshot.docs) {
        totalCount++;
        const q = doc.data();
        const resolved = resolveSubjectCode(q.subjectCode || q.subject);
        
        const targetCode = resolved.code;
        const targetSubject = resolved.name;

        if (q.subjectCode !== targetCode || q.subject !== targetSubject) {
            await db.collection('questions').doc(doc.id).update({
                subjectCode: targetCode,
                subject: targetSubject,
                updatedAt: new Date().toISOString()
            });
            updatedCount++;
            console.log(`   ✓ Updated [${updatedCount}] doc ${doc.id}: subjectCode="${targetCode}", subject="${targetSubject}"`);
        } else {
            console.log(`   - Verified doc ${doc.id}: already has subjectCode="${q.subjectCode}"`);
        }
    }

    console.log(`\n🎉 Migration Completed! Updated ${updatedCount} out of ${totalCount} questions.`);
    process.exit(0);
}

migrateSubjectCodes().catch(err => {
    console.error('❌ Migration Error:', err);
    process.exit(1);
});
