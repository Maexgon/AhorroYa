
'use server';

import { 
    generateFinancialInsights, 
    type GenerateFinancialInsightsInput, 
    type GenerateFinancialInsightsOutput 
} from '@/ai/flows/generate-financial-insights';
import { initializeAdminApp } from '@/firebase/admin-config';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';


/**
 * Generates financial insights by calling the AI flow and saves the result to Firestore.
 * This action is designed to be called from the client. It orchestrates
 * the call to the AI flow and returns the generated analysis.
 *
 * @param {GenerateFinancialInsightsInput} input - The financial data required by the AI.
 * @returns {Promise<{success: boolean; data?: GenerateFinancialInsightsOutput; error?: string}>} - The result of the AI processing.
 */
export async function generateInsightsAction(
    input: GenerateFinancialInsightsInput,
    tenantId: string,
    userId: string,
): Promise<{ success: boolean; data?: GenerateFinancialInsightsOutput; error?: string; }> {
    try {
        const result = await generateFinancialInsights(input);
        
        if (!result) {
            console.warn('AI flow returned empty or null result for insights.');
            return { success: false, error: 'La IA no pudo generar un análisis con los datos proporcionados.' };
        }

        // --- Save report to Firestore ---
        try {
            await initializeAdminApp();
            const firestore = getFirestore();
            const reportsRef = firestore.collection('reports');
            const newReportRef = reportsRef.doc();
            
            const newReportData = {
                id: newReportRef.id,
                tenantId: tenantId,
                userId: userId,
                createdAt: new Date().toISOString(),
                reportMonth: input.reportMonth,
                reportYear: input.reportYear,
                data: JSON.stringify(result) // Store the full report data
            };
            
            await newReportRef.set(newReportData);

        } catch (dbError: any) {
            console.error('Error saving report to Firestore:', dbError);
            // We don't block the user if saving fails, but we return a warning.
            // The main result is still successful.
            return { 
                success: true, 
                data: result, 
                error: 'El análisis se generó pero no pudo ser guardado para consultas futuras.' 
            };
        }
        // --- End of save logic ---

        return { success: true, data: result };

    } catch (e: any) {
        console.error('Error in generateInsightsAction:', e);
        return { success: false, error: e.message || 'Ocurrió un error desconocido al generar el análisis.' };
    }
}
