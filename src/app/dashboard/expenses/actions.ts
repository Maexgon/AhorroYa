"use server";

import { initializeApp, getApp, getApps } from "firebase/app";
import { getStorage, ref, getSignedUrl } from "firebase/storage";
import { processReceipt, type ProcessReceiptOutput } from "@/ai/flows/ocr-receipt-processing";
import { firebaseConfig } from "@/firebase/config";

type SignedURLResponse = {
    success: true;
    url: string;
    gcsUri: string;
} | {
    success: false;
    error: string;
};

// ACCIÓN 1: Generar una URL firmada para la subida segura desde el cliente.
export async function getSignedURLAction(tenantId: string, userId: string, file: { type: string, name: string }): Promise<SignedURLResponse> {
    console.log("[SERVER ACTION START] getSignedURLAction");
    if (!file || !tenantId || !userId) {
        console.error("[SERVER ACTION ERROR] Faltan datos:", { hasFile: !!file, hasTenantId: !!tenantId, hasUserId: !!userId });
        return { success: false, error: 'Faltan datos para generar la URL (archivo, tenantId, o userId).' };
    }

    try {
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        const storage = getStorage(app);
        
        const filePath = `receipts/${tenantId}/${userId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        
        // Generar la URL firmada para la operación 'put'
        const signedUrl = await getSignedUrl(storageRef, {
          action: 'write',
          contentType: file.type,
          expires: Date.now() + 15 * 60 * 1000, // 15 minutos
        });

        console.log("[SERVER ACTION SUCCESS] URL Firmada generada.");
        return { 
            success: true, 
            url: signedUrl,
            gcsUri: `gs://${storageRef.bucket}/${storageRef.fullPath}`
        };

    } catch (error: any) {
        console.error("[SERVER ACTION CRITICAL] Ocurrió un error en getSignedURLAction:", error);
        return { success: false, error: `Error en el servidor al generar URL: ${error.code || error.message}` };
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
        return { error: `Error en el servidor durante el procesamiento de IA: ${error.code || error.message}` };
    }
}
