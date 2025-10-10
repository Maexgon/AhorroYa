
"use server";

import { processReceipt, type ProcessReceiptOutput } from "@/ai/flows/ocr-receipt-processing";

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
