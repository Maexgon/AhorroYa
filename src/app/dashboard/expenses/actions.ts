
'use server';

import { processReceipt, type ProcessReceiptOutput, type ProcessReceiptInput } from '@/ai/flows/ocr-receipt-processing';
import { initializeAdminApp } from '@/firebase/admin-config';
import { getStorage } from 'firebase-admin/storage';


/**
 * Processes multiple image receipts using an AI flow.
 *
 * @param {ProcessReceiptInput} input - The input for the AI flow, containing base64 contents.
 * @returns {Promise<{success: boolean; data?: ProcessReceiptOutput; error?: string}>} - The result of the AI processing.
 */
export async function processReceiptAction(
    input: ProcessReceiptInput
): Promise<{ success: boolean; data?: ProcessReceiptOutput; error?: string; }> {
    try {
        console.log('[ACTION] Calling processReceipt with input:', { ...input, base64Contents: input.base64Contents ? `${input.base64Contents.length} images` : 'none' });
        const result = await processReceipt(input);
        console.log('[ACTION] Received result from processReceipt:', result);
        
        if (!result || Object.keys(result).length === 0) {
            console.warn('AI flow returned empty or null result.');
            return { success: false, error: 'La IA no pudo extraer datos del recibo. Inténtalo de nuevo.' };
        }
        
        const hasData = Object.values(result).some(v => v !== undefined && v !== null && v !== '');
        if (!hasData) {
            console.warn('AI output was generated but all fields are empty.');
            return { success: false, error: 'La IA no pudo extraer datos del recibo, la respuesta estaba vacía.' };
        }

        return { success: true, data: result };

    } catch (e: any) {
        console.error('Error in processReceiptAction:', e);
        return { success: false, error: e.message || 'An unknown error occurred during receipt processing.' };
    }
}


/**
 * Uploads a PDF to Firebase Storage using the Admin SDK and then processes it using an AI flow.
 *
 * @param {FormData} formData - The form data containing the PDF file and other details.
 * @returns {Promise<{success: boolean; data?: ProcessReceiptOutput; error?: string}>} - The result of the AI processing.
 */
export async function uploadAndProcessPdfAction(
    formData: FormData
): Promise<{ success: boolean; data?: ProcessReceiptOutput; error?: string; }> {
    try {
        const pdfFile = formData.get('pdf') as File;
        const tenantId = formData.get('tenantId') as string;
        const userId = formData.get('userId') as string;
        const categories = formData.get('categories') as string;

        if (!pdfFile || !tenantId || !userId) {
            return { success: false, error: 'Faltan datos para procesar el PDF.' };
        }
        
        console.log('[PDF ACTION] Uploading PDF to Storage via Admin SDK...');
        
        // Initialize Admin App and get Storage bucket
        await initializeAdminApp();
        const bucket = getStorage().bucket();
        const filePath = `receipts/${tenantId}/${userId}/${Date.now()}-${pdfFile.name}`;
        const fileUpload = bucket.file(filePath);

        const fileBuffer = Buffer.from(await pdfFile.arrayBuffer());

        await fileUpload.save(fileBuffer, {
            metadata: {
                contentType: pdfFile.type,
            },
        });
        
        const gsUrl = `gs://${bucket.name}/${filePath}`;
        console.log(`[PDF ACTION] PDF uploaded. gsUrl: ${gsUrl}`);

        console.log('[PDF ACTION] Calling processReceipt flow...');
        const result = await processReceipt({
            receiptId: `temp-${crypto.randomUUID()}`,
            fileUrl: gsUrl,
            tenantId,
            userId,
            fileType: 'pdf',
            categories
        });
        console.log('[PDF ACTION] Received result from processReceipt:', result);
        
        if (!result || Object.keys(result).length === 0) {
            console.warn('AI flow returned empty or null result for PDF.');
            return { success: false, error: 'La IA no pudo extraer datos del PDF.' };
        }
        
        return { success: true, data: result };

    } catch (e: any) {
        console.error('Error in uploadAndProcessPdfAction:', e);
        return { success: false, error: e.message || 'Ocurrió un error desconocido al procesar el PDF.' };
    }
}
