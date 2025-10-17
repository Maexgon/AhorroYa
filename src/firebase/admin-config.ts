// src/firebase/admin-config.ts
import admin from 'firebase-admin';

// This function initializes the Firebase Admin SDK.
// It checks if the app is already initialized to prevent errors.
// It uses environment variables for credentials, which is secure for server-side code.
export async function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // In a deployed Google environment (like Cloud Run, Cloud Functions),
  // GOOGLE_APPLICATION_CREDENTIALS is set automatically.
  // For local development, you'd set this environment variable to point to your service account JSON file.
  const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? admin.credential.applicationDefault()
    : undefined;

  return admin.initializeApp({
    credential,
  });
}
