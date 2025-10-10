
"use server";

import { initializeApp, getApp, getApps } from "firebase/app";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { processReceipt, type ProcessReceiptOutput } from "@/ai/flows/ocr-receipt-processing";
import { firebaseConfig } from "@/firebase/config";

// Acción para subir el archivo al bucket de Firebase Storage
export async function uploadReceiptAction(formData: FormData): Promise<{ success: boolean; gcsUri?: string; error?: string; }> {
    console.log("[SERVER ACTION START] uploadReceiptAction");
    const file = formData.get('receipt') as File;

    if (!file) {
        return { success: false, error: 'No se encontró el archivo en el FormData.' };
    }

    try {
        console.log("[SERVER ACTION] Inicializando Firebase App...");
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        const storage = getStorage(app);
        
        // Se extrae la información necesaria del formData
        const tenantId = formData.get('tenantId') as string;
        const userId = formData.get('userId') as string;

        if (!tenantId || !userId) {
            return { success: false, error: 'Falta tenantId o userId en el FormData.' };
        }

        const filePath = `receipts/${tenantId}/${userId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        console.log(`[SERVER ACTION] Creada referencia de storage: ${filePath}`);
        
        const fileBuffer = await file.arrayBuffer();
        console.log(`[SERVER ACTION] Archivo convertido a buffer, tamaño: ${fileBuffer.byteLength}. Intentando subir...`);

        await uploadBytes(storageRef, fileBuffer, { contentType: file.type });

        const gcsUri = `gs://${storageRef.bucket}/${storageRef.fullPath}`;
        console.log(`[SERVER ACTION SUCCESS] Archivo subido. GCS URI: ${gcsUri}`);
        
        return { success: true, gcsUri };

    } catch (error: any) {
        console.error("[SERVER ACTION CRITICAL] Error en uploadReceiptAction:", error);
        return { success: false, error: `Error en el servidor durante la subida: ${error.code || error.message}` };
    }
}


// ACCIÓN: Procesar el recibo después de que se haya subido.
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
