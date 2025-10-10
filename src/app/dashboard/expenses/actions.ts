"use server";

import { initializeApp, getApp, getApps } from "firebase/app";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { processReceipt, type ProcessReceiptOutput } from "@/ai/flows/ocr-receipt-processing";

// firebaseConfig is NOT imported here, as it's for client-side use.

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
        // Correctly initialize Firebase on the server for this action.
        // This ensures that if the app is already initialized, we use the existing instance.
        // Calling initializeApp() without arguments uses the service account credentials
        // available in the server environment (e.g., Firebase App Hosting).
        const app = getApps().length ? getApp() : initializeApp();
        const storage = getStorage(app); 
        
        const filePath = `receipts/${tenantId}/${userId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        
        // Convert the file to a Buffer to be uploaded.
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        
        // The upload itself.
        await uploadBytes(storageRef, fileBuffer, {
            contentType: file.type,
        });
        
        // The GCS URI needed for the AI flow.
        const gcsUri = `gs://${storageRef.bucket}/${storageRef.fullPath}`;

        // Call the Genkit flow to process the receipt.
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
        // Provide a more specific error message if available from the Firebase error object.
        return { error: `Error en el servidor: ${error.code || error.message}` };
    }
}
