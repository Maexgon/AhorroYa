import { initializeApp, getApps, getApp } from "firebase/app";

// IMPORTANT: The key in this object is intentionally named NEXT_PUBLIC_FIREBASE_API_KEY
// to align with Next.js standards for exposing environment variables to the client-side.
// This is NOT a security risk, as Firebase API keys are public and used for client-side
// identification. Security is enforced by Firestore Security Rules.
export const firebaseConfig = {
  "projectId": "studio-211410928-89967",
  "appId": "1:361417134147:web:a75ba8426bc05f165a04f6",
  "storageBucket": "studio-211410928-89967.appspot.com",
  "apiKey": process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCgaV8MHmFDuwQrvETWMkJkAXjN6X_9n3s",
  "authDomain": "studio-211410928-89967.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "361417134147"
};

// This function is intended for both client and server-side use now.
export function initializeFirebase() {
  if (getApps().length) {
    return getApp();
  }
  // The config object now safely uses an environment variable for the API key.
  return initializeApp(firebaseConfig);
}

// Add this environment variable for the admin SDK
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = firebaseConfig.storageBucket;
