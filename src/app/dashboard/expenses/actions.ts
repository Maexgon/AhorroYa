
'use server';

import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { processReceipt, type ProcessReceiptInput } from '@/ai/flows/ocr-receipt-processing';
import { initializeFirebase } from '@/firebase/config';
import { getApps } from 'firebase/app';

interface ActionResult {
    success: boolean;
    data?: any;
    error?: string;
}

// Initialize Firebase for server-side usage if not already done.
if (!getApps().length) {
    initializeFirebase();
}
const firestore = getFirestore();


export async function processReceiptAction(
    base64Content: string,
    fileType: 'image' | 'pdf',
    tenantId: string,
    userId: string
): Promise<ActionResult> {
    if (!base64Content) {
        return { success: false, error: 'No se proporcionó contenido de archivo.' };
    }
     if (!tenantId || !userId) {
        return { success: false, error: 'Falta información de usuario o tenant.' };
    }

    try {
        // 1. Save the raw receipt data to Firestore
        const receiptRawRef = doc(collection(firestore, 'receipts_raw'));
        await setDoc(receiptRawRef, {
            id: receiptRawRef.id,
            tenantId,
            userId,
            base64Content, // Storing the base64 string
            fileType,
            status: 'processing',
            createdAt: new Date().toISOString(),
        });
        
        // 2. Call the AI flow with the Base64 content
        const processInput: ProcessReceiptInput = {
            receiptId: receiptRawRef.id,
            base64Content,
            tenantId,
            userId,
            fileType,
        };

        const result = await processReceipt(processInput);
        
        // 3. Update the raw receipt doc with the result
        await setDoc(receiptRawRef, {
            status: 'processed',
            ocrPayload: JSON.stringify(result),
        }, { merge: true });


        return { success: true, data: result };

    } catch (e: any) {
        console.error("Error in processReceiptAction:", e);
        return { success: false, error: e.message || 'Error en el servidor al procesar el recibo.' };
    }
}
