# Firebase & Cloud Firestore Setup & Seeding Guide

This document outlines the two options for seeding your Cloud Firestore database with the 60 questions and 3 exam blueprints.

---

## 🚀 Seeding Methods

### Option 1: Firebase Admin SDK (Recommended for Backend)

1. Open your [Firebase Console](https://console.firebase.google.com/).
2. Select your project **`competitive-tester`**.
3. Click **Project Settings** (Gear icon ⚙️ at top left) > **Service accounts** tab.
4. Click **Generate new private key** and click **Generate key**.
5. Save or rename the downloaded JSON file to:
   ```text
   d:/icm_dev1/serviceAccountKey.json
   ```
6. Run the Admin SDK seeder in your terminal:
   ```bash
   npm run seed:admin
   ```

---

### Option 2: Web Client SDK (Quick Setup)

1. Open your [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **Build > Firestore Database** in the left sidebar.
3. Click the **Rules** tab at the top.
4. Replace the existing rules with the following test rule and click **Publish**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

5. Run the Client SDK seeder in your terminal:
   ```bash
   npm run seed:db
   ```

---

## 🗄️ Database Collections Populated

| Collection | Description | Document Count |
| :--- | :--- | :--- |
| `exams` | Pattern Blueprints (Police Bharti, Vanrakshak, SSC GD). | 3 Documents |
| `questions` | Sample Bilingual Questions with options & explanations. | 60 Documents |
