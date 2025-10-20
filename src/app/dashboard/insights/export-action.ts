'use server';

import type { GenerateFinancialInsightsOutput } from '@/ai/flows/generate-financial-insights';

// This server action is no longer used for DOCX export, but could be repurposed.
// For now, it is kept to avoid breaking imports if it were referenced elsewhere,
// but the client-side PDF export logic in the page component is now the primary method.
export async function exportToDocxServerAction(
    insightsData: GenerateFinancialInsightsOutput,
    baseCurrency: string
): Promise<{ success: boolean; fileContent?: string; error?: string; }> {
    return { success: false, error: 'La exportación a DOCX ha sido reemplazada por PDF.' };
}
