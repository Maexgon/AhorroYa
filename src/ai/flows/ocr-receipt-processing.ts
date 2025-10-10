
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
  gcsUri: z.string().describe('The Google Cloud Storage URI of the receipt image or PDF (gs://...).'),
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

const doclingParseTool = ai.defineTool({
  name: 'doclingParse',
  description: 'Call the Docling service to parse a receipt image or PDF and extract structured data.',
  inputSchema: z.object({
    gcsUri: z.string().describe('The Google Cloud Storage URI of the receipt image or PDF.'),
    tenantId: z.string().describe('The ID of the tenant.'),
    userId: z.string().describe('The ID of the user uploading the receipt.'),
    fileType: z.enum(['image', 'pdf']).describe('The type of the uploaded file.'),
  }),
  outputSchema: ProcessReceiptOutputSchema,
},
async (input) => {
  const parseUrl = process.env.DOCLING_PARSE_URL ?? 'http://localhost:8080/parse';
  console.log(`Calling Docling service at ${parseUrl} with input:`, JSON.stringify(input));
  const response = await fetch(parseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Error calling Docling service:', response.status, response.statusText, errorBody);
    throw new Error(`Failed to call Docling service: ${response.status} ${response.statusText}`);
  }
  const result = await response.json();
  console.log('Received from Docling service:', result);
  return result as ProcessReceiptOutput;
}
);

const processReceiptPrompt = ai.definePrompt({
  name: 'processReceiptPrompt',
  tools: [doclingParseTool],
  input: {schema: ProcessReceiptInputSchema},
  output: {schema: ProcessReceiptOutputSchema},
  prompt: `You are an AI assistant designed to process receipts.
The user has provided a file located at the Google Cloud Storage URI: {{{gcsUri}}}.
Your ONLY task is to call the 'doclingParse' tool with the provided input to extract the receipt data.
Do not attempt any other action. Call the tool and return its output directly.
`,
});

const processReceiptFlow = ai.defineFlow(
  {
    name: 'processReceiptFlow',
    inputSchema: ProcessReceiptInputSchema,
    outputSchema: ProcessReceiptOutputSchema,
  },
  async input => {
    console.log('Starting processReceiptFlow with input:', input);
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
