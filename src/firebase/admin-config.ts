
// src/firebase/admin-config.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';

const serviceAccount = {
  "projectId": "studio-211410928-89967",
  "clientEmail": "firebase-adminsdk-p1vpr@studio-211410928-89967.iam.gserviceaccount.com",
  // IMPORTANT: The private key is handled securely by the environment and
  // is not hardcoded here. It's injected via environment variables.
  "privateKey": process.env.FIREBASE_PRIVATE_KEY,
};

/**
 * Initializes the Firebase Admin SDK, ensuring it's only done once.
 * This is safe to call multiple times.
 */
export async function initializeAdminApp() {
    // Using a named app to avoid conflicts if the default app is used elsewhere.
    const appName = 'admin-sdk-app';
    const existingApp = getApps().find(app => app.name === appName);
    if (existingApp) {
        return existingApp;
    }
    
    if (!process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error("FIREBASE_PRIVATE_KEY environment variable is not set. Cannot initialize Admin SDK.");
    }
    
    // The private key needs to be parsed correctly.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

    return initializeApp({
        credential: cert({
            projectId: serviceAccount.projectId,
            clientEmail: serviceAccount.clientEmail,
            privateKey: privateKey,
        }),
        storageBucket: `${serviceAccount.projectId}.appspot.com`,
    }, appName);
}
