'use server';

import htmlToDocx from 'html-to-docx';
import type { GenerateFinancialInsightsOutput } from '@/ai/flows/generate-financial-insights';


export async function exportToDocxServerAction(
    insightsData: GenerateFinancialInsightsOutput,
    baseCurrency: string
): Promise<{ success: boolean; fileContent?: string; error?: string; }> {
    if (!insightsData) {
        return { success: false, error: 'No hay datos de análisis para exportar.' };
    }
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat("es-AR", { style: 'currency', currency: baseCurrency }).format(amount);

    try {
        let htmlString = `
            <h1>Análisis Financiero - Ahorro Ya</h1>
            <h2>Resumen General</h2>
            <p>${insightsData.generalSummary}</p>
            <br />
            <h2>Recomendaciones Clave</h2>
        `;

        insightsData.keyRecommendations.forEach(rec => {
            htmlString += `
                <h3>${rec.emoji || ''} ${rec.title}</h3>
                <p><strong>Descripción:</strong> ${rec.description}</p>
                <p><strong>Sugerencia:</strong> ${rec.suggestion}</p>
                <br />
            `;
        });

        htmlString += '<h2>Ajustes de Presupuesto Sugeridos</h2>';
        insightsData.budgetAdjustments.forEach(adj => {
            htmlString += `
                <p><strong>Categoría:</strong> ${adj.categoryName}</p>
                <p>Monto Actual: ${formatCurrency(adj.currentAmount)}</p>
                <p>Monto Sugerido: ${formatCurrency(adj.suggestedAmount)}</p>
                <p><i>Razón: ${adj.reasoning}</i></p>
                <br />
            `;
        });

        htmlString += '<h2>Consejos de Ahorro</h2><ul>';
        insightsData.savingsTips.forEach(tip => {
            htmlString += `<li>${tip}</li>`;
        });
        htmlString += '</ul>';

        const fileBuffer = await htmlToDocx(htmlString, undefined, {
            table: { row: { cantSplit: true } },
            footer: true,
            pageNumber: true,
        });

        return { success: true, fileContent: (fileBuffer as Buffer).toString('base64') };

    } catch (e: any) {
        console.error('Error exporting to DOCX:', e);
        return { success: false, error: 'No se pudo generar el documento de Word en el servidor.' };
    }
}
