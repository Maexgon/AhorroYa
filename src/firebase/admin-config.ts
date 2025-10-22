
'use server';

import admin from 'firebase-admin';

// Re-implement the initializeAdminApp function to be self-contained.
// This avoids build issues with top-level awaits or module resolution in Next.js Server Actions.
export async function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Environment variables for Firebase Admin SDK are expected to be set in the deployment environment.
  // This is a more secure and standard practice than hardcoding credentials.
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : undefined;

  const credential = serviceAccount
    ? admin.credential.cert(serviceAccount)
    : admin.credential.applicationDefault();

  return admin.initializeApp({
    credential,
  });
}
