'use server';

import admin from 'firebase-admin';

// Re-implement the initializeAdminApp function to be self-contained.
// This avoids build issues with top-level awaits or module resolution in Next.js Server Actions.
export async function initializeAdminApp() {
  // Use the same project ID as the client-side config
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-211410928-89967";

  if (admin.apps.length > 0 && admin.apps.find(app => app?.name === '[DEFAULT]')) {
    return admin.app();
  }

  // Environment variables for Firebase Admin SDK are expected to be set in the deployment environment.
  // This is a more secure and standard practice than hardcoding credentials.
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : undefined;
  
  if (serviceAccount) {
    serviceAccount.project_id = projectId;
  }
  
  const credential = serviceAccount
    ? admin.credential.cert(serviceAccount)
    : admin.credential.applicationDefault();

  return admin.initializeApp({
    credential,
    projectId,
  });
}
