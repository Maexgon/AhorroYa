'use server';

import { 
    generateFinancialInsights, 
    type GenerateFinancialInsightsInput, 
    type GenerateFinancialInsightsOutput 
} from '@/ai/flows/generate-financial-insights';

/**
 * Generates financial insights by calling the AI flow.
 * This action is designed to be called from the client. It orchestrates
 * the call to the AI flow and returns the generated analysis.
 *
 * @param {GenerateFinancialInsightsInput} input - The financial data required by the AI.
 * @returns {Promise<{success: boolean; data?: GenerateFinancialInsightsOutput; error?: string}>} - The result of the AI processing.
 */
export async function generateInsightsAction(
    input: GenerateFinancialInsightsInput
): Promise<{ success: boolean; data?: GenerateFinancialInsightsOutput; error?: string; }> {
    try {
        const result = await generateFinancialInsights(input);
        
        if (!result || !result.insights || result.insights.length === 0) {
            console.warn('AI flow returned empty or null result for insights.');
            return { success: false, error: 'La IA no pudo generar un análisis con los datos proporcionados.' };
        }

        return { success: true, data: result };

    } catch (e: any) {
        console.error('Error in generateInsightsAction:', e);
        return { success: false, error: e.message || 'Ocurrió un error desconocido al generar el análisis.' };
    }
}
