import { initializeApp, getApps, getApp } from "firebase/app";

export const firebaseConfig = {
  "projectId": "studio-211410928-89967",
  "appId": "1:361417134147:web:a75ba8426bc05f165a04f6",
  "storageBucket": "studio-211410928-89967.appspot.com",
  "apiKey": "AIzaSyCgaV8MHmFDuwQrvETWMkJkAXjN6X_9n3s",
  "authDomain": "studio-211410928-89967.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "361417134147"
};

// This function is intended for SERVER-SIDE use only.
// It uses a simplified initialization and does not include all the client-side SDKs.
export function initializeFirebase() {
  if (getApps().length) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}
