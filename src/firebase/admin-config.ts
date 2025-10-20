// src/firebase/admin-config.ts
import admin from 'firebase-admin';

// This function initializes the Firebase Admin SDK.
// It checks if the app is already initialized to prevent errors.
export async function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Use service account credentials from environment variables if available.
  // This is a common pattern for Vercel, Cloud Run, etc.
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : undefined;

  const credential = serviceAccount
    ? admin.credential.cert(serviceAccount)
    : admin.credential.applicationDefault(); // Fallback for GAE, Cloud Functions, etc.

  return admin.initializeApp({
    credential,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}
