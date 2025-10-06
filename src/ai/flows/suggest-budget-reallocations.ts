// src/ai/flows/suggest-budget-reallocations.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting budget re-allocations based on user spending data.
 *
 * The flow takes a user's transaction history as input and uses an LLM to analyze spending patterns
 * and suggest potential budget adjustments to optimize savings. It exports the SuggestBudgetReallocations function, the
 * SuggestBudgetReallocationsInput type, and the SuggestBudgetReallocationsOutput type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestBudgetReallocationsInputSchema = z.object({
  transactionHistory: z.string().describe('A JSON string containing the user transaction history with category, amount, and date.'),
  currentBudget: z.string().describe('A JSON string containing the user current budget allocations per category.'),
  baseCurrency: z.string().describe('The base currency of the user.'),
});

export type SuggestBudgetReallocationsInput = z.infer<typeof SuggestBudgetReallocationsInputSchema>;

const SuggestBudgetReallocationsOutputSchema = z.object({
  suggestions: z.string().describe('A JSON string containing budget reallocation suggestions with category and suggested amount.'),
  reasoning: z.string().describe('The reasoning behind the suggested budget re-allocations.'),
});

export type SuggestBudgetReallocationsOutput = z.infer<typeof SuggestBudgetReallocationsOutputSchema>;

export async function suggestBudgetReallocations(
  input: SuggestBudgetReallocationsInput
): Promise<SuggestBudgetReallocationsOutput> {
  return suggestBudgetReallocationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestBudgetReallocationsPrompt',
  input: {schema: SuggestBudgetReallocationsInputSchema},
  output: {schema: SuggestBudgetReallocationsOutputSchema},
  prompt: `You are a personal finance advisor. Analyze the user's transaction history and current budget to suggest budget re-allocations to optimize savings.

Transaction History: {{{transactionHistory}}}
Current Budget: {{{currentBudget}}}
Base Currency: {{{baseCurrency}}}

Provide suggestions in JSON format, including the category and suggested amount. Explain the reasoning behind each suggestion.
`,
});

const suggestBudgetReallocationsFlow = ai.defineFlow(
  {
    name: 'suggestBudgetReallocationsFlow',
    inputSchema: SuggestBudgetReallocationsInputSchema,
    outputSchema: SuggestBudgetReallocationsOutputSchema,
  },
  async input => {
    try {
      JSON.parse(input.transactionHistory);
    } catch (e) {
      throw new Error('Invalid JSON for transactionHistory: ' + e);
    }

    try {
      JSON.parse(input.currentBudget);
    } catch (e) {
      throw new Error('Invalid JSON for currentBudget: ' + e);
    }
    const {output} = await prompt(input);
    return output!;
  }
);
