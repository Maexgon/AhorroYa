
"use server";

import { processReceipt, type ProcessReceiptOutput } from "@/ai/flows/ocr-receipt-processing";

export async function processReceiptAction(gcsUri: string, tenantId: string, userId: string, fileType: 'image' | 'pdf'): Promise<{ success: boolean; data?: ProcessReceiptOutput; error?: string }> {
    console.log("Processing receipt with AI for gcsUri:", gcsUri);
    try {
        const result = await processReceipt({
            gcsUri,
            tenantId,
            userId,
            fileType,
        });

        console.log("AI processing result:", result);
        return { success: true, data: result };
    } catch (error: any) {
        console.error("Error calling processReceipt flow:", error);
        return { success: false, error: error.message || "Error al procesar el recibo con IA." };
    }
}
