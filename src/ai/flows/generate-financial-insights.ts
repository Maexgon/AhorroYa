// src/ai/flows/generate-financial-insights.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating financial insights based on user spending data.
 *
 * The flow takes a user's transaction history, budgets, and categories as input and uses an LLM
 * to analyze spending patterns and provide actionable recommendations.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const GenerateFinancialInsightsInputSchema = z.object({
  monthlyExpenses: z.string().describe("A JSON string of the user's expenses for the selected month."),
  monthlyIncomes: z.string().describe("A JSON string of the user's incomes for the selected month."),
  pendingInstallments: z.string().describe("A JSON string of future pending installment payments."),
  budgets: z.string().describe("A JSON string of the user's budgets for the same period."),
  categories: z.string().describe('A JSON string of available categories.'),
  baseCurrency: z.string().describe('The base currency (e.g., ARS).'),
  reportDate: z.string().describe('The date the report is being generated (e.g., YYYY-MM-DD).'),
  userName: z.string().describe("The name of the user requesting the report."),
  reportMonth: z.string().describe("The name of the month the report covers (e.g., 'Octubre')."),
  reportYear: z.string().describe("The year the report covers (e.g., '2024')."),
});
export type GenerateFinancialInsightsInput = z.infer<typeof GenerateFinancialInsightsInputSchema>;

const RecommendationSchema = z.object({
    title: z.string().describe('A short, catchy title for the recommendation.'),
    description: z.string().describe('A detailed paragraph explaining the finding and its context (e.g., overspending in a category).'),
    suggestion: z.string().describe('A concrete, actionable suggestion for the user.'),
    emoji: z.string().optional().describe('An emoji that represents the insight (e.g., 💡, 💸, 📈).'),
});

const BudgetAdjustmentSchema = z.object({
    categoryName: z.string().describe('The name of the category for the budget adjustment.'),
    currentAmount: z.number().describe('The current budgeted amount for this category.'),
    suggestedAmount: z.number().describe('The newly suggested budget amount for the next period.'),
    reasoning: z.string().describe('A brief explanation for the suggested adjustment.'),
});

const GenerateFinancialInsightsOutputSchema = z.object({
  generalSummary: z.string().describe("A brief, one-paragraph summary of the user's overall financial health for the period, in Spanish."),
  keyRecommendations: z.array(RecommendationSchema).describe('An array of key recommendations, including savings opportunities and areas of overspending.'),
  budgetAdjustments: z.array(BudgetAdjustmentSchema).describe('An array of suggested budget adjustments for the next period.'),
  savingsTips: z.array(z.string()).describe('A list of general, actionable savings tips relevant to the user.'),
});
export type GenerateFinancialInsightsOutput = z.infer<typeof GenerateFinancialInsightsOutputSchema>;


export async function generateFinancialInsights(
  input: GenerateFinancialInsightsInput
): Promise<GenerateFinancialInsightsOutput> {
  return generateFinancialInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFinancialInsightsPrompt',
  input: {schema: GenerateFinancialInsightsInputSchema},
  output: {schema: GenerateFinancialInsightsOutputSchema},
  prompt: `Actúas como un asesor financiero experto para usuarios en Argentina. Tu tono es encouraging, claro y profesional. Analiza los datos financieros del usuario para el período seleccionado y proporciona un informe estructurado en español.

Datos del informe:
- Fecha de Generación: {{{reportDate}}}
- Generado para: {{{userName}}}
- Período del Reporte: {{{reportMonth}}} de {{{reportYear}}}
- Moneda Base: {{{baseCurrency}}}

Aquí están los datos del usuario:
- Categorías y Subcategorías: {{{categories}}}
- Presupuestos del mes: {{{budgets}}}
- Ingresos del mes: {{{monthlyIncomes}}}
- Gastos del mes: {{{monthlyExpenses}}}
- Cuotas futuras pendientes: {{{pendingInstallments}}}

Tu tarea es generar un informe con las siguientes secciones:
1.  **generalSummary**: Escribe un resumen conciso de un párrafo sobre la situación financiera general del usuario. **IMPORTANTE: Incluye al principio del resumen la fecha del reporte, el nombre del usuario y el período que cubre el reporte.** Luego, menciona el total de ingresos vs. el total de gastos, el ahorro neto (o déficit) y la principal categoría de gasto.
2.  **keyRecommendations**: Genera 2-4 recomendaciones clave. Identifica los puntos de ahorro más importantes, los excesos de gastos significativos en comparación con los presupuestos y oportunidades de mejora. Para cada recomendación, proporciona un título, una descripción, una sugerencia concreta y un emoji.
3.  **budgetAdjustments**: Sugiere 2-3 ajustes de presupuesto para el próximo período basados en los gastos actuales. Para cada ajuste, especifica el nombre de la categoría, el monto actual, el monto sugerido y una breve justificación.
4.  **savingsTips**: Proporciona una lista de 3 consejos de ahorro generales y accionables que sean relevantes para el contexto del usuario (por ejemplo, si gasta mucho en delivery, un consejo relacionado).

Sé específico y realista en tus sugerencias. Por ejemplo, en lugar de "gasta menos en comida", sugiere "considera reducir tus gastos en 'Delivery' en $5,000, ya que representa el 60% de tus gastos en 'Comestibles'".
`,
});

const generateFinancialInsightsFlow = ai.defineFlow(
  {
    name: 'generateFinancialInsightsFlow',
    inputSchema: GenerateFinancialInsightsInputSchema,
    outputSchema: GenerateFinancialInsightsOutputSchema,
  },
  async input => {
    try {
      JSON.parse(input.monthlyExpenses);
      JSON.parse(input.monthlyIncomes);
      JSON.parse(input.pendingInstallments);
      JSON.parse(input.budgets);
      JSON.parse(input.categories);
    } catch (e: any) {
      console.error('Invalid JSON input for financial insights flow', e);
      throw new Error('Invalid JSON format in input data.');
    }
    const {output} = await prompt(input);
    
    if (!output) {
        throw new Error('AI failed to generate insights.');
    }

    return output;
  }
);
