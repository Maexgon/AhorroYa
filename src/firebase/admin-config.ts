// IMPORTANT: This file is only used by server-side code and should not be
// included in any client-side code.
import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { credential } from 'firebase-admin';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }
  
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. This is required for Admin SDK initialization.');
  }

  try {
     return initializeApp({
      credential: credential.cert(JSON.parse(serviceAccount)),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
  } catch (error: any) {
    console.error('Error initializing Firebase Admin SDK:', error);
    throw new Error('Could not initialize Firebase Admin SDK. ' + error.message);
  }
}

export async function initializeAdminApp(): Promise<App> {
  return getAdminApp();
}