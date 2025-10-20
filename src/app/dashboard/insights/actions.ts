'use server';

import { 
    generateFinancialInsights, 
    type GenerateFinancialInsightsInput, 
    type GenerateFinancialInsightsOutput 
} from '@/ai/flows/generate-financial-insights';
import { exportToDocxServerAction } from './export-action';


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
        
        if (!result) {
            console.warn('AI flow returned empty or null result for insights.');
            return { success: false, error: 'La IA no pudo generar un análisis con los datos proporcionados.' };
        }

        return { success: true, data: result };

    } catch (e: any) {
        console.error('Error in generateInsightsAction:', e);
        return { success: false, error: e.message || 'Ocurrió un error desconocido al generar el análisis.' };
    }
}


/**
 * Orchestrates the export of financial insights to a DOCX file by calling a server-only action.
 * @param {GenerateFinancialInsightsOutput} insightsData - The data to be included in the report.
 * @returns {Promise<{success: boolean; fileContent?: string; error?: string}>}
 */
export async function exportToDocxAction(
    insightsData: GenerateFinancialInsightsOutput,
    baseCurrency: string
): Promise<{ success: boolean; fileContent?: string; error?: string; }> {
    return await exportToDocxServerAction(insightsData, baseCurrency);
}
