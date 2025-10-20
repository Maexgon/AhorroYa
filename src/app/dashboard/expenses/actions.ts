
'use server';

import { processReceipt, type ProcessReceiptOutput, type ProcessReceiptInput } from '@/ai/flows/ocr-receipt-processing';

/**
 * Processes a receipt using an AI flow. It can handle multiple image
 * content as base64 strings or a single file URL from Firebase Storage (for PDFs).
 *
 * @param {ProcessReceiptInput} input - The input for the AI flow, containing either base64 contents or a file URL.
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
