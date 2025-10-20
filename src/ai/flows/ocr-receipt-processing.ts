
'use server';

/**
 * @fileOverview An OCR receipt processing AI agent.
 *
 * - processReceipt - A function that handles the receipt processing flow.
 * - ProcessReceiptInput - The input type for the processReceipt function.
 * - ProcessReceiptOutput - The return type for the processReceipt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProcessReceiptInputSchema = z.object({
  receiptId: z.string().describe('The ID of the raw receipt document in Firestore.'),
  base64Contents: z.array(z.string()).optional().describe("An array of Base64 encoded strings of the receipt images. Must include MIME type (e.g., 'data:image/png;base64,...')."),
  fileUrl: z.string().optional().describe('A Firebase Storage URL (gs://...) pointing to a receipt file (e.g., a PDF).'),
  tenantId: z.string().describe('The ID of the tenant.'),
  userId: z.string().describe('The ID of the user uploading the receipt.'),
  fileType: z.enum(['image', 'pdf']).describe('The type of the uploaded file.'),
  categories: z.string().describe('A JSON string of available categories and subcategories.'),
});
export type ProcessReceiptInput = z.infer<typeof ProcessReceiptInputSchema>;

const ProcessReceiptOutputSchema = z.object({
  cuit: z.string().optional().describe('The CUIT of the entity.'),
  razonSocial: z.string().optional().describe('The business name of the entity.'),
  fecha: z.string().optional().describe('The date on the receipt (YYYY-MM-DD).'),
  total: z.number().optional().describe('The total amount on the receipt.'),
  iva: z.number().optional().describe('The IVA amount on the receipt.'),
  nFactura: z.string().optional().describe('The invoice number.'),
  medioPago: z.string().optional().describe('The payment method used.'),
  categoryId: z.string().optional().describe('The suggested category ID.'),
  subcategoryId: z.string().optional().describe('The suggested subcategory ID.'),
});
export type ProcessReceiptOutput = z.infer<typeof ProcessReceiptOutputSchema>;

export async function processReceipt(input: ProcessReceiptInput): Promise<ProcessReceiptOutput> {
  return processReceiptFlow(input);
}


const processReceiptPrompt = ai.definePrompt({
  name: 'processReceiptPrompt',
  input: {schema: ProcessReceiptInputSchema},
  output: {schema: ProcessReceiptOutputSchema},
  prompt: `You are an expert AI specializing in extracting information from Argentinian receipts and categorizing expenses.

Your tasks are:
1.  Analyze the provided receipt document(s) and extract key information:
    - CUIT (Clave Única de Identificación Tributaria)
    - Razón Social (Business Name)
    - Fecha (Date of the transaction in YYYY-MM-DD format)
    - Total (The final total amount as a number)
    - IVA (The VAT amount, if specified)
    - N° Factura (The invoice or ticket number)
    - Medio de Pago (Payment method, e.g., 'Efectivo', 'Tarjeta de Debito')

2.  Based on the receipt content (especially the Razón Social), suggest the most appropriate category and subcategory from the provided list. Return the corresponding 'id' for both the category and subcategory.

If a field is not present in the document or cannot be determined, omit it from the output.

Here are the available categories and subcategories:
{{{categories}}}

Document(s) to process:
{{#if fileUrl}}
  {{media url=fileUrl}}
{{else}}
  {{#each base64Contents}}
    {{media url=this}}
  {{/each}}
{{/if}}
`,
});

const processReceiptFlow = ai.defineFlow(
  {
    name: 'processReceiptFlow',
    inputSchema: ProcessReceiptInputSchema,
    outputSchema: ProcessReceiptOutputSchema,
  },
  async input => {
    console.log('[FLOW] Starting processReceiptFlow for receiptId:', input.receiptId);
    if (!input.fileUrl && (!input.base64Contents || input.base64Contents.length === 0)) {
        console.error('[FLOW] No content provided.');
        throw new Error('No receipt content provided. Either fileUrl or base64Contents must be present.');
    }
    
    try {
      console.log('[FLOW] Calling processReceiptPrompt...');
      const {output} = await processReceiptPrompt(input);
      console.log('[FLOW] Received output from prompt:', output);
      
      if (!output) {
        console.error('[FLOW] The AI prompt did not return any output.');
        throw new Error('The AI prompt did not return any output.');
      }
      // Basic validation to check if at least one key has a value
      const hasData = Object.values(output).some(v => v !== undefined && v !== null && v !== '');
      if (!hasData) {
         console.warn('[FLOW] AI output was generated but all fields are empty.');
      }

      return output;
    } catch (e: any) {
      console.error('[FLOW] Error in processReceiptFlow:', e);
      // Re-throw the error so the action can catch it and report it to the client.
      throw e;
    }
  }
);
