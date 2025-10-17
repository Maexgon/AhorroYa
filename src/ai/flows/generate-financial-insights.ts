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
  expenses: z.string().describe('A JSON string of the user\'s expenses for a given period.'),
  budgets: z.string().describe('A JSON string of the user\'s budgets for the same period.'),
  categories: z.string().describe('A JSON string of available categories.'),
  baseCurrency: z.string().describe('The base currency (e.g., ARS).'),
});
export type GenerateFinancialInsightsInput = z.infer<typeof GenerateFinancialInsightsInputSchema>;

const InsightSchema = z.object({
    title: z.string().describe('A short, catchy title for the insight.'),
    description: z.string().describe('A detailed paragraph explaining the finding and its context.'),
    suggestion: z.string().describe('A concrete, actionable suggestion for the user.'),
    emoji: z.string().optional().describe('An emoji that represents the insight (e.g., 💡, 💸, 📈).'),
});

const GenerateFinancialInsightsOutputSchema = z.object({
  summary: z.string().describe('A brief, one-paragraph summary of the user\'s overall financial health for the period.'),
  insights: z.array(InsightSchema).describe('An array of specific, actionable insights.'),
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
  prompt: `You are an expert financial advisor for users in Argentina. Your tone is encouraging, clear, and professional.
Analyze the user's financial data for the given period and provide a summary and a list of actionable insights.

The base currency is {{{baseCurrency}}}. All monetary values are in this currency.

Here is the user's data:
- Categories: {{{categories}}}
- Budgets: {{{budgets}}}
- Expenses: {{{expenses}}}

Your task is to:
1.  Write a concise, one-paragraph summary of the user's financial situation. Mention the total income vs. total expenses, and the main category of spending.
2.  Generate 2-4 specific, actionable insights. For each insight:
    - Provide a short, clear title.
    - An emoji to visually represent the insight.
    - A description explaining the 'what' and 'why' of the insight based on the data.
    - A concrete suggestion on what the user can do. Be specific (e.g., "Consider reducing your 'Delivery' spending by $5,000" instead of "Spend less on food").

Focus on identifying patterns, areas of overspending compared to budgets, and opportunities for reallocation or savings. Make sure your suggestions are realistic and helpful.
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
      JSON.parse(input.expenses);
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
