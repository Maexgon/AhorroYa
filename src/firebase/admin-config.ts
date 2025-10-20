import * as admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';

// This function initializes the Firebase Admin SDK.
// It's designed to be idempotent, so it can be called multiple times without issue.
export const initializeAdminApp = () => {
  // Check if the app is already initialized to prevent errors.
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // When deployed to Firebase App Hosting, the SDK can automatically
  // discover the service account credentials. In a local environment,
  // you would typically need to set the GOOGLE_APPLICATION_CREDENTIALS
  // environment variable.
  try {
    return admin.initializeApp();
  } catch (error) {
    console.error("Firebase Admin SDK initialization failed:", error);
    // This fallback might be useful in some local dev scenarios but
    // is generally not recommended for production.
    // The automatic discovery is the preferred method.
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId,
    });
  }
};
