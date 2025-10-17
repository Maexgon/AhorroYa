// src/firebase/admin-config.ts
import admin from 'firebase-admin';

// This function initializes the Firebase Admin SDK.
// It checks if the app is already initialized to prevent errors.
// It uses environment variables for credentials, which is secure for server-side code.
export async function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Environment variables for Firebase Admin SDK are automatically
  // picked up by initializeApp() when deployed to Firebase services.
  // For local development, you need to set up a service account file.
  // See: https://firebase.google.com/docs/admin/setup
  const credential = admin.credential.applicationDefault();

  return admin.initializeApp({
    credential,
  });
}
