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
    console.log("[SERVER ACTION START] uploadReceiptAction");
    const file = formData.get('receipt') as File | null;
    const tenantId = formData.get('tenantId') as string | null;
    const userId = formData.get('userId') as string | null;

    if (!file || !tenantId || !userId) {
        console.error("[SERVER ACTION ERROR] Faltan datos:", { hasFile: !!file, hasTenantId: !!tenantId, hasUserId: !!userId });
        return { error: 'Faltan datos para procesar el recibo (archivo, tenantId, o userId).' };
    }
    
    console.log(`[SERVER ACTION INFO] File: ${file.name}, Size: ${file.size}, Type: ${file.type}`);

    try {
        console.log("[SERVER ACTION INFO] Inicializando Firebase...");
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        console.log("[SERVER ACTION SUCCESS] Firebase inicializado. Project ID:", app.options.projectId);
        
        const storage = getStorage(app); 
        console.log("[SERVER ACTION INFO] Instancia de Storage obtenida.");
        
        const filePath = `receipts/${tenantId}/${userId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        console.log("[SERVER ACTION INFO] Referencia de Storage creada:", storageRef.fullPath);
        
        console.log("[SERVER ACTION INFO] Convirtiendo archivo a Buffer...");
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        console.log("[SERVER ACTION SUCCESS] Archivo convertido a Buffer. Length:", fileBuffer.length);
        
        console.log("[SERVER ACTION INFO] Subiendo archivo a Firebase Storage...");
        await uploadBytes(storageRef, fileBuffer, {
            contentType: file.type,
        });
        console.log("[SERVER ACTION SUCCESS] Archivo subido exitosamente a:", filePath);
        
        const gcsUri = `gs://${storageRef.bucket}/${storageRef.fullPath}`;
        console.log("[SERVER ACTION INFO] Llamando al flujo de IA con GCS URI:", gcsUri);

        const result = await processReceipt({
            gcsUri: gcsUri,
            tenantId: tenantId,
            userId: userId,
            fileType: file.type.includes('pdf') ? 'pdf' : 'image',
        });
        console.log("[SERVER ACTION SUCCESS] El flujo de IA devolvió un resultado.");

        if (!result) {
            console.error("[SERVER ACTION ERROR] El servicio de IA no devolvió resultados.");
            return { error: 'El servicio de IA no devolvió resultados.' };
        }

        console.log("[SERVER ACTION END] Devolviendo datos al cliente.");
        return { data: result };

    } catch (error: any) {
        // Loguear el error completo en el servidor para un mejor diagnóstico
        console.error("[SERVER ACTION CRITICAL] Ocurrió un error en uploadReceiptAction:", error);
        console.error("[SERVER ACTION CRITICAL] Código de error:", error.code);
        console.error("[SERVER ACTION CRITICAL] Mensaje de error:", error.message);
        console.error("[SERVER ACTION CRITICAL] Stack de error:", error.stack);
        // Devolver un mensaje de error más específico si es posible
        return { error: `Error en el servidor: ${error.code || error.message}` };
    }
}
