
'use server';

import { processReceipt, type ProcessReceiptOutput, type ProcessReceiptInput } from '@/ai/flows/ocr-receipt-processing';

/**
 * Processes a receipt image using an AI flow without writing to the database.
 * This action is designed to be called from the client. It only orchestrates
 * the call to the AI flow and returns the extracted data.
 *
 * @param {string} base64Content - The Base64 encoded string of the receipt image.
 * @param {string} tenantId - The ID of the tenant.
 * @param {string} userId - The ID of the user.
 * @param {'image' | 'pdf'} fileType - The type of the file.
 * @param {string} categoriesJson - A JSON string of available categories for the AI to use.
 * @returns {Promise<{success: boolean; data?: ProcessReceiptOutput; error?: string}>} - The result of the AI processing.
 */
export async function processReceiptAction(
    base64Content: string,
    tenantId: string,
    userId: string,
    fileType: 'image' | 'pdf',
    categoriesJson: string
): Promise<{ success: boolean; data?: ProcessReceiptOutput; error?: string; }> {
    try {
        const input: ProcessReceiptInput = {
            receiptId: `temp-${crypto.randomUUID()}`,
            base64Content,
            tenantId,
            userId,
            fileType,
            categories: categoriesJson
        };

        const result = await processReceipt(input);
        
        if (!result || Object.keys(result).length === 0) {
            console.warn('AI flow returned empty or null result.');
            return { success: false, error: 'La IA no pudo extraer datos del recibo. Inténtalo de nuevo.' };
        }
        
        return { success: true, data: result };

    } catch (e: any) {
        console.error('Error in processReceiptAction:', e);
        return { success: false, error: e.message || 'An unknown error occurred during receipt processing.' };
    }
}
