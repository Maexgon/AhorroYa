
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
  base64Content: z.string().describe("A Base64 encoded string of the receipt image or PDF. Must include MIME type (e.g., 'data:image/png;base64,...')."),
  tenantId: z.string().describe('The ID of the tenant.'),
  userId: z.string().describe('The ID of the user uploading the receipt.'),
  fileType: z.enum(['image', 'pdf']).describe('The type of the uploaded file.'),
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
});
export type ProcessReceiptOutput = z.infer<typeof ProcessReceiptOutputSchema>;

export async function processReceipt(input: ProcessReceiptInput): Promise<ProcessReceiptOutput> {
  return processReceiptFlow(input);
}

// This tool is now a placeholder. The logic is directly in the prompt.
// We could replace this with a real call to an external OCR service if needed.
const doclingParseTool = ai.defineTool({
  name: 'doclingParse',
  description: 'Parses a receipt document and extracts structured data.',
  inputSchema: ProcessReceiptInputSchema,
  outputSchema: ProcessReceiptOutputSchema,
},
async (input) => {
  // In a real scenario, this would call an external OCR service
  // with the base64Content. For now, we rely on the prompt's capabilities.
  console.log(`Simulating call to Docling service for receiptId: ${input.receiptId}`);
  // This is a mock. The actual processing will happen in the prompt that receives the image.
  return {};
}
);


const processReceiptPrompt = ai.definePrompt({
  name: 'processReceiptPrompt',
  // The tool is available but the prompt text will guide the LLM
  // to extract info from the image directly.
  tools: [doclingParseTool], 
  input: {schema: ProcessReceiptInputSchema},
  output: {schema: ProcessReceiptOutputSchema},
  prompt: `You are an expert AI specializing in extracting information from Argentinian receipts.
Analyze the provided document and extract the following fields. If a field is not present, omit it.

- cuit: The CUIT number (Clave Única de Identificación Tributaria).
- razonSocial: The business name.
- fecha: The date of the transaction in YYYY-MM-DD format.
- total: The final total amount as a number.
- iva: The IVA (Impuesto al Valor Agregado) amount, if specified.
- nFactura: The invoice or ticket number.
- medioPago: The payment method (e.g., 'Efectivo', 'Tarjeta de Debito').

Here is the document: {{media url=base64Content}}
`,
});

const processReceiptFlow = ai.defineFlow(
  {
    name: 'processReceiptFlow',
    inputSchema: ProcessReceiptInputSchema,
    outputSchema: ProcessReceiptOutputSchema,
  },
  async input => {
    console.log('Starting processReceiptFlow with input for receiptId:', input.receiptId);
    try {
      const {output} = await processReceiptPrompt(input);
      console.log('processReceiptPrompt output:', output);
      if (!output) {
        throw new Error('The AI prompt did not return any output.');
      }
      return output;
    } catch (e: any) {
      console.error('Error in processReceiptFlow:', e.message);
      // Return a structured error or empty values
      return {
        cuit: '',
        razonSocial: '',
        fecha: '',
        total: 0,
        iva: 0,
        nFactura: '',
        medioPago: '',
      };
    }
  }
);
