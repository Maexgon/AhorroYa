
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

// This tool simulates a call to an external OCR service like Docling.
const doclingParseTool = ai.defineTool({
  name: 'doclingParse',
  description: 'Parses a receipt document image or PDF and extracts structured data.',
  inputSchema: z.object({
    base64Content: z.string(),
    fileType: z.enum(['image', 'pdf']),
  }),
  outputSchema: ProcessReceiptOutputSchema,
},
async (input) => {
    // In a real-world scenario, this would make an API call to Docling.
    // For this app, we are using the multi-modal capabilities of the LLM itself
    // to perform the OCR inside the prompt. This tool definition is here
    // to guide the model, but the core logic is in the prompt's `prompt` field.
    console.log('doclingParseTool invoked. The real work happens in the prompt.');
    // The model will extract the data from the image provided in the prompt.
    // This function's return is bypassed as the model generates the output directly.
    return {};
}
);


const processReceiptPrompt = ai.definePrompt({
  name: 'processReceiptPrompt',
  tools: [doclingParseTool], 
  input: {schema: ProcessReceiptInputSchema},
  output: {schema: ProcessReceiptOutputSchema},
  prompt: `You are an expert AI specializing in extracting information from Argentinian receipts.
Your task is to analyze the provided receipt document and extract key information.

Analyze the document provided in the input and extract the following fields:
- CUIT (Clave Única de Identificación Tributaria)
- Razón Social (Business Name)
- Fecha (Date of the transaction in YYYY-MM-DD format)
- Total (The final total amount as a number)
- IVA (The VAT amount, if specified)
- N° Factura (The invoice or ticket number)
- Medio de Pago (Payment method, e.g., 'Efectivo', 'Tarjeta de Debito')

If a field is not present in the document, omit it from the output.

Document to process:
{{media url=base64Content}}
`,
});

const processReceiptFlow = ai.defineFlow(
  {
    name: 'processReceiptFlow',
    inputSchema: ProcessReceiptInputSchema,
    outputSchema: ProcessReceiptOutputSchema,
  },
  async input => {
    console.log('Starting processReceiptFlow for receiptId:', input.receiptId);
    try {
      const {output} = await processReceiptPrompt(input);
      console.log('processReceiptPrompt output:', output);
      
      if (!output) {
        throw new Error('The AI prompt did not return any output.');
      }
      // Basic validation to check if at least one key has a value
      const hasData = Object.values(output).some(v => v !== undefined && v !== null && v !== '');
      if (!hasData) {
         console.warn('AI output was generated but all fields are empty.');
      }

      return output;
    } catch (e: any) {
      console.error('Error in processReceiptFlow:', e.message);
      // Return a structured error or empty values to avoid crashing the client
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
