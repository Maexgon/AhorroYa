// DO NOT ADD 'use client' to this file
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";

// This function is specifically for SERVER-SIDE use (e.g., in Server Actions).
// It initializes the Firebase app and returns the necessary SDKs.
export function initializeFirebaseServer() {
  if (getApps().length) {
    const app = getApp();
    return {
      firestore: getFirestore(app),
      auth: getAuth(app),
    };
  }

  const app = initializeApp(firebaseConfig);

  return {
    firestore: getFirestore(app),
    auth: getAuth(app),
  };
}
