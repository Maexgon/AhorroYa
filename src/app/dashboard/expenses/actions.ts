"use server";

import { initializeApp, getApp, getApps } from "firebase/app";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { processReceipt, type ProcessReceiptOutput } from "@/ai/flows/ocr-receipt-processing";
import { firebaseConfig } from "@/firebase/config"; // Importar la configuración

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
        // Inicialización correcta para el entorno de servidor, asegurando que solo ocurra una vez.
        // Se le pasa explícitamente la configuración para evitar el error 'app/no-options'.
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        const storage = getStorage(app); 
        
        const filePath = `receipts/${tenantId}/${userId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        
        // Convertir el archivo a un ArrayBuffer y luego a un Buffer para la subida
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
        // Loguear el error completo en el servidor para un mejor diagnóstico
        console.error("[Server Action Error] uploadReceiptAction:", error);
        // Devolver un mensaje de error más específico si es posible
        return { error: `Error en el servidor: ${error.code || error.message}` };
    }
}
