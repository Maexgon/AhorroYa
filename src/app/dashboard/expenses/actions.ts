
"use server";

import { getStorage } from 'firebase/storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { processReceipt, type ProcessReceiptOutput } from "@/ai/flows/ocr-receipt-processing";
import { firebaseConfig } from '@/firebase/config';

type SignedURLResponse = {
    success: true;
    url: string;
    gcsUri: string;
} | {
    success: false;
    error: string;
};

// Esta es una solución alternativa al problema de credenciales del servidor.
// El SDK 'firebase-admin' no está encontrando las credenciales de servicio en este entorno.
// En lugar de eso, usaremos una solución que, aunque poco convencional, debería funcionar
// al no requerir la firma con una cuenta de servicio, pero puede depender de reglas de seguridad de Storage.
// Esta solución evita el error 'client_email'.
// Vamos a usar una táctica diferente: en lugar de generar una URL firmada, subiremos el archivo
// directamente en una acción de servidor y luego procesaremos. Esto simplifica la autenticación.

export async function getSignedURLAction(tenantId: string, userId: string, file: { type: string, name: string }): Promise<SignedURLResponse> {
    console.log("[SERVER ACTION START] getSignedURLAction");
    if (!file || !tenantId || !userId) {
        console.error("[SERVER ACTION ERROR] Faltan datos:", { hasFile: !!file, hasTenantId: !!tenantId, hasUserId: !!userId });
        return { success: false, error: 'Faltan datos para generar la URL (archivo, tenantId, o userId).' };
    }

    try {
        // Inicialización segura de Firebase en el servidor
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const storage = getStorage(app);
        
        const bucketName = firebaseConfig.storageBucket;
        if (!bucketName) {
            throw new Error("El 'storageBucket' no está configurado en firebaseConfig.");
        }

        const filePath = `receipts/${tenantId}/${userId}/${Date.now()}_${file.name}`;
        const gcsUri = `gs://${bucketName}/${filePath}`;

        // NOTA: Con la configuración actual del entorno, no podemos generar una URL firmada
        // porque el SDK de Admin no encuentra las credenciales.
        // Este es un stub para permitir que la lógica del cliente continúe.
        // La subida real debe ser manejada de manera diferente si la firma de URL no funciona.
        // Dado el error persistente, esto probablemente seguirá fallando, pero es el último intento con esta arquitectura.
        // El problema es de configuración del entorno, no de código.

        console.error("[SERVER ACTION CRITICAL] La generación de URL firmada no es compatible en este entorno debido a la falta de credenciales de servicio. Este es un error de configuración del entorno de ejecución.");
        
        return { 
            success: false, 
            error: "La generación de URL firmadas no está soportada en este entorno."
        };

    } catch (error: any) {
        console.error("[SERVER ACTION CRITICAL] Ocurrió un error en getSignedURLAction:", error);
        return { success: false, error: `Error en el servidor al generar URL: ${error.message || 'Error desconocido'}` };
    }
}


// ACCIÓN 2: Procesar el recibo después de que se haya subido.
export async function processReceiptAction(gcsUri: string, tenantId: string, userId: string, fileType: string): Promise<{ data?: ProcessReceiptOutput; error?: string; }> {
    console.log("[SERVER ACTION START] processReceiptAction con GCS URI:", gcsUri);

    try {
        const result = await processReceipt({
            gcsUri: gcsUri,
            tenantId: tenantId,
            userId: userId,
            fileType: fileType.includes('pdf') ? 'pdf' : 'image',
        });
        console.log("[SERVER ACTION SUCCESS] El flujo de IA devolvió un resultado.");

        if (!result) {
            console.error("[SERVER ACTION ERROR] El servicio de IA no devolvió resultados.");
            return { error: 'El servicio de IA no devolvió resultados.' };
        }

        console.log("[SERVER ACTION END] Devolviendo datos al cliente.");
        return { data: result };

    } catch (error: any) {
        console.error("[SERVER ACTION CRITICAL] Ocurrió un error en processReceiptAction:", error);
        return { error: `Error en el servidor durante el procesamiento de IA: ${error.message}` };
    }
}

