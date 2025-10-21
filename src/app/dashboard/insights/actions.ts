
'use server';

import { generateFinancialInsights, type GenerateFinancialInsightsInput, type GenerateFinancialInsightsOutput } from '@/ai/flows/generate-financial-insights';
import { initializeFirebase } from '@/firebase/config';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

/**
 * Calls the AI flow to generate financial insights and saves the report to Firestore.
 * @param input - The financial data required for the AI flow.
 * @param tenantId - The ID of the current tenant.
 * @param userId - The ID of the user requesting the report.
 * @returns An object with the generated data or an error message.
 */
export async function generateInsightsAction(
    input: GenerateFinancialInsightsInput,
    tenantId: string,
    userId: string
): Promise<{ success: boolean; data?: GenerateFinancialInsightsOutput; error?: string; }> {
    try {
        console.log('[ACTION] Calling generateFinancialInsights for tenant:', tenantId);
        const result = await generateFinancialInsights(input);

        if (!result) {
            console.warn('[ACTION] AI flow returned null or undefined result.');
            return { success: false, error: 'La IA no pudo generar el reporte. La respuesta fue vacía.' };
        }
        
        // Asynchronously save the report to Firestore without blocking the response to the user.
        saveReportToFirestore(result, tenantId, userId, input.reportMonth, input.reportYear)
            .catch(dbError => {
                // Log the database error, but don't fail the whole operation since the user already has the insights.
                console.error("Failed to save report to Firestore:", dbError);
                // We can pass a soft error message back to the client if needed.
            });
        
        return { success: true, data: result };

    } catch (e: any) {
        console.error('Error in generateInsightsAction:', e);
        return { success: false, error: e.message || 'An unknown error occurred during insight generation.' };
    }
}

/**
 * Saves the generated financial report to the 'reports' collection in Firestore.
 * This is a helper function to be called in the background.
 */
async function saveReportToFirestore(
    reportData: GenerateFinancialInsightsOutput,
    tenantId: string,
    userId: string,
    reportMonth: string,
    reportYear: string
) {
     try {
        const firebaseApp = initializeFirebase();
        const firestore = getFirestore(firebaseApp);
        
        const reportRef = doc(firestore, 'reports', crypto.randomUUID());

        const dataToSave = {
            id: reportRef.id,
            tenantId,
            userId,
            createdAt: new Date().toISOString(),
            reportMonth,
            reportYear,
            data: JSON.stringify(reportData), // Store the full report as a JSON string
        };

        await setDoc(reportRef, dataToSave);
        console.log(`[ACTION] Report ${reportRef.id} saved to Firestore.`);
    } catch (error) {
        // This error should be logged, but it won't be sent to the user
        // as the primary action (generating insights) was already successful.
        console.error('Error saving report to Firestore:', error);
        // Optionally, re-throw to be caught by the caller's .catch block if needed
        throw new Error('Failed to save report to the database.');
    }
}
