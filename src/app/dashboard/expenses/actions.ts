"use server";

import { getStorage, ref, uploadBytes } from "firebase/storage";
import { processReceipt, type ProcessReceiptOutput } from "@/ai/flows/ocr-receipt-processing";
import { initializeFirebase } from "@/firebase/config"; // Using a different initialize to avoid client/server conflicts

// Initialize Firebase Admin SDK for server-side operations
// This is a simplified initialization. In a real app, you'd manage this more robustly.
const firebaseApp = initializeFirebase();
const storage = getStorage(firebaseApp);

type ActionResult = {
    data?: ProcessReceiptOutput;
    error?: string;
}

export async function uploadReceiptAction(formData: FormData): Promise<ActionResult> {
    const file = formData.get('receipt') as File | null;
    const tenantId = formData.get('tenantId') as string | null;
    const userId = formData.get('userId') as string | null;

    if (!file || !tenantId || !userId) {
        return { error: 'Faltan datos para procesar el recibo (archivo, tenantId, o userId).' };
    }

    try {
        const filePath = `receipts/${tenantId}/${userId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        
        // Convert file to buffer to upload from server
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        
        await uploadBytes(storageRef, fileBuffer, {
            contentType: file.type,
        });
        
        const gcsUri = `gs://${storageRef.bucket}/${storageRef.fullPath}`;

        const result = await processReceipt({
            gcsUri: gcsUri,
            tenantId: tenantId,
            userId: userId,
            fileType: file.type.includes('pdf') ? 'pdf' : 'image',
        });

        if (!result) {
            return { error: 'El servicio de IA no devolvió resultados.' };
        }

        return { data: result };

    } catch (error: any) {
        console.error("[Server Action Error] uploadReceiptAction:", error);
        return { error: error.message || "Un error desconocido ocurrió en el servidor." };
    }
}
