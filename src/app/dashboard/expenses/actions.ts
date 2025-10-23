
'use server';

import { processReceipt, type ProcessReceiptOutput, type ProcessReceiptInput } from '@/ai/flows/ocr-receipt-processing';

/**
 * Processes multiple image or PDF receipts by sending their Base64 content to an AI flow.
 *
 * @param {ProcessReceiptInput} input - The input for the AI flow, containing base64 contents.
 * @returns {Promise<{success: boolean; data?: ProcessReceiptOutput; error?: string}>} - The result of the AI processing.
 */
export async function processReceiptAction(
    input: ProcessReceiptInput
): Promise<{ success: boolean; data?: ProcessReceiptOutput; error?: string; }> {
    try {
        console.log('[ACTION] Calling processReceipt with input files:', input.base64Contents.length);
        const result = await processReceipt(input);
        console.log('[ACTION] Received result from processReceipt:', result);
        
        if (!result) {
            console.warn('[ACTION] AI flow returned null or undefined result.');
            return { success: false, error: 'La IA no pudo procesar el recibo. La respuesta fue vacía.' };
        }
        
        const hasData = Object.values(result).some(v => v !== undefined && v !== null && v !== '');
        if (!hasData) {
            console.warn('[ACTION] AI output was generated but all fields are empty.');
            return { success: false, error: 'La IA no pudo extraer datos del recibo, la respuesta estaba vacía.' };
        }

        return { success: true, data: result };

    } catch (e: any) {
        console.error('[ACTION] Error in processReceiptAction:', e);
        return { success: false, error: e.message || 'An unknown error occurred during receipt processing.' };
    }
}
