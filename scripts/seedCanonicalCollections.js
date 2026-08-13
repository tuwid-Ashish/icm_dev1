import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');

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

async function seedCanonical() {
    console.log('🚀 Running Canonical Firestore Collection Seeding via Firebase Admin SDK...');

    // 1. Seed Packages Collection
    console.log('📦 Seeding `packages` collection...');
    const defaultPackages = [
        {
            id: 'pkg_police_100',
            name: 'Police Bharti Special – 100 Tests',
            exam: 'Police Bharti',
            totalTests: 100,
            price: 299,
            discountPrice: 199,
            validity: '12 Months',
            status: 'active',
            createdAt: new Date().toISOString()
        },
        {
            id: 'pkg_vanrakshak_100',
            name: 'Maharashtra Vanrakshak – 100 Tests',
            exam: 'Vanrakshak',
            totalTests: 100,
            price: 299,
            discountPrice: 199,
            validity: '12 Months',
            status: 'active',
            createdAt: new Date().toISOString()
        },
        {
            id: 'pkg_ssc_gd_100',
            name: 'SSC GD Constable – 100 Tests',
            exam: 'SSC GD',
            totalTests: 100,
            price: 299,
            discountPrice: 199,
            validity: '12 Months',
            status: 'active',
            createdAt: new Date().toISOString()
        }
    ];

    for (const pkg of defaultPackages) {
        await db.collection('packages').doc(pkg.id).set(pkg, { merge: true });
        console.log(`   ✓ Created package document: packages/${pkg.id}`);
    }

    // 2. Seed Settings Document (settings/payment)
    console.log('💳 Seeding `settings/payment` document...');
    const defaultPaymentSettings = {
        merchantName: 'SigmaForce CEP Official',
        upiId: 'sigmaforce@upi',
        qrImageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi://pay?pa=sigmaforce@upi%26pn=SigmaForce%26cu=INR',
        razorpayKeyId: 'rzp_test_E66NI3Yg44x1mj',
        updatedAt: new Date().toISOString()
    };
    await db.collection('settings').doc('payment').set(defaultPaymentSettings, { merge: true });
    console.log('   ✓ Created payment settings document: settings/payment');

    // 3. Ensure test_attempts and package_requests collections exist with schema placeholder or initial records
    console.log('📁 Verifying `test_attempts` and `package_requests` collections...');
    
    // Check if test_attempts has documents
    const testAttemptsSnap = await db.collection('test_attempts').get();
    console.log(`   • test_attempts: ${testAttemptsSnap.size} documents present.`);

    // Check if package_requests has documents
    const packageReqSnap = await db.collection('package_requests').get();
    console.log(`   • package_requests: ${packageReqSnap.size} documents present.`);

    console.log('\n🎉 Canonical Firestore Collection Seeding Complete!');
    process.exit(0);
}

seedCanonical().catch(err => {
    console.error('❌ Error seeding canonical collections:', err);
    process.exit(1);
});
