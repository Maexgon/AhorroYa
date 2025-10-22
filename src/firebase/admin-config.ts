
'use server';

import admin from 'firebase-admin';

/**
 * Initializes the Firebase Admin SDK, ensuring it only happens once.
 * This function is designed to be robust for Next.js Server Actions and environments
 * where environment variables might not be loaded via a .env file.
 */
export async function initializeAdminApp() {
  // If the default app already exists, return it to prevent re-initialization errors.
  if (admin.apps.length > 0 && admin.apps[0]?.name === '[DEFAULT]') {
    return admin.apps[0];
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-211410928-89967";

  // Try to parse the service account from the environment variable.
  // This is the most secure way to handle credentials in production.
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  let credential;

  if (serviceAccountEnv) {
    try {
      const serviceAccount = JSON.parse(serviceAccountEnv);
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.warn("Could not parse FIREBASE_SERVICE_ACCOUNT. Falling back to Application Default Credentials. Error:", e);
      // Fallback to application default credentials if parsing fails
      credential = admin.credential.applicationDefault();
    }
  } else {
    // If the environment variable is not set, use Application Default Credentials.
    // This is common in Google Cloud environments (like Cloud Run, Cloud Functions).
    console.log("FIREBASE_SERVICE_ACCOUNT not set. Using Application Default Credentials.");
    credential = admin.credential.applicationDefault();
  }

  try {
    return admin.initializeApp({
      credential,
      projectId: projectId,
    });
  } catch (error: any) {
    // Catch potential initialization errors, e.g., if default creds are not found.
    console.error("Firebase Admin SDK initialization failed:", error.message);
    throw new Error("Could not initialize Firebase Admin SDK. Please check server configuration.");
  }
}
