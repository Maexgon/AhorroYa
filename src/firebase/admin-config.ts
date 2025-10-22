
'use server';

import admin from 'firebase-admin';
import { config } from 'dotenv';

// Carga las variables de entorno desde el archivo .env
config();

export async function initializeAdminApp() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-211410928-89967";

  // Si la app por defecto ya existe, la retornamos para evitar reinicializaciones
  if (admin.apps.length > 0 && admin.apps.find(app => app?.name === '[DEFAULT]')) {
    return admin.app();
  }

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (!serviceAccountEnv) {
      console.error("FIREBASE_SERVICE_ACCOUNT is not set in the environment variables.");
      throw new Error("Missing FIREBASE_SERVICE_ACCOUNT environment variable. Cannot initialize admin SDK.");
  }
  
  try {
      const serviceAccount = JSON.parse(serviceAccountEnv);
      
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId,
      });

  } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT. Make sure it's a valid JSON string.", e);
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT format.");
  }
}
