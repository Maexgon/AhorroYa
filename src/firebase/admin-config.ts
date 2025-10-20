import admin from 'firebase-admin';

// Variable para almacenar la instancia de la app para evitar reinicializaciones
let app: admin.app.App;

/**
 * Initializes the Firebase Admin SDK.
 * 
 * This function ensures that the SDK is initialized only once (singleton pattern).
 * It attempts to initialize with a service account from environment variables.
 * 
 * @returns {Promise<admin.app.App>} A promise that resolves with the initialized Firebase app instance.
 * @throws {Error} Throws an error if the service account credentials are not found or are invalid.
 */
export async function initializeAdminApp(): Promise<admin.app.App> {
  // Si la app ya está inicializada, la retornamos directamente
  if (app) {
    return app;
  }

  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountString) {
    throw new Error('La variable de entorno FIREBASE_SERVICE_ACCOUNT_KEY no está definida. No se puede inicializar el Admin SDK.');
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);

    console.log('[Admin SDK] Inicializando con credenciales de cuenta de servicio...');
    
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // Añade la URL de la base de datos si es necesario, pero usualmente no es requerido.
      // databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    }, 'adminApp' + Date.now()); // Nombre único para evitar conflictos

    console.log('[Admin SDK] Inicialización completada con éxito.');
    return app;

  } catch (error: any) {
    console.error('[Admin SDK] Error al parsear las credenciales de la cuenta de servicio:', error);
    throw new Error('Las credenciales en FIREBASE_SERVICE_ACCOUNT_KEY tienen un formato JSON inválido.');
  }
}
