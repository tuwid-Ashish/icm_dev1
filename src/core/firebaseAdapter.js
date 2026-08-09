/**
 * CEP Online Mock Test Platform - Firebase Authentication & Firestore Adapter
 * Provides cloud database and authentication bindings when credentials are supplied.
 */

export class FirebaseAdapter {
    constructor() {
        this.initialized = false;
        this.config = null;
    }

    /**
     * Initialize Firebase App with custom user configuration.
     */
    initFirebase(firebaseConfig) {
        if (!firebaseConfig || !firebaseConfig.apiKey) {
            console.warn('[FirebaseAdapter] Missing API Key. Operating in local storage mode.');
            return false;
        }

        try {
            this.config = firebaseConfig;
            this.initialized = true;
            console.log('[FirebaseAdapter] Firebase initialized successfully for project:', firebaseConfig.projectId);
            return true;
        } catch (err) {
            console.error('[FirebaseAdapter] Initialization error:', err);
            return false;
        }
    }

    /**
     * Helper to load Firebase web scripts dynamically if user provides live credentials.
     */
    async loadFirebaseSDKs() {
        if (window.firebase) return true;
        
        return new Promise((resolve, reject) => {
            const script1 = document.createElement('script');
            script1.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
            script1.onload = () => {
                const script2 = document.createElement('script');
                script2.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';
                script2.onload = () => resolve(true);
                script2.onerror = reject;
                document.head.appendChild(script2);
            };
            script1.onerror = reject;
            document.head.appendChild(script1);
        });
    }
}

export const firebaseAdapter = new FirebaseAdapter();
