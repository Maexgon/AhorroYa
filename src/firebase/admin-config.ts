
'use server';

import admin from 'firebase-admin';

// Re-implement the initializeAdminApp function to be self-contained and robust.
export async function initializeAdminApp() {
  // If the default app is already initialized, return it to prevent errors.
  if (admin.apps.length > 0 && admin.apps[0]) {
    return admin.apps[0];
  }

  // Use Application Default Credentials. This is the standard and most secure way 
  // to authenticate in Google Cloud environments, which this runtime emulates.
  // It avoids needing to manage service account keys directly in code.
  try {
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (error: any) {
    console.error("Firebase Admin SDK initialization failed:", error.message);
    // This provides a clear error if the environment is not set up correctly,
    // which is more helpful for debugging than the previous access token errors.
    throw new Error("Could not initialize Firebase Admin SDK. The server environment may be missing credentials.");
  }
}
