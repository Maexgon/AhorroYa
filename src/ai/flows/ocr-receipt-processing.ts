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
  gcsUri: z.string().describe('The Google Cloud Storage URI of the receipt image or PDF.'),
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
  description: 'Call the Docling service to parse a receipt image or PDF and extract data.',
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
  const response = await fetch(parseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    console.error('Error calling Docling service:', response.status, response.statusText);
    throw new Error(`Failed to call Docling service: ${response.status} ${response.statusText}`);
  }
  return await response.json() as ProcessReceiptOutput;
}
);

const processReceiptPrompt = ai.definePrompt({
  name: 'processReceiptPrompt',
  tools: [doclingParseTool],
  input: {schema: ProcessReceiptInputSchema},
  output: {schema: ProcessReceiptOutputSchema},
  prompt: `You are an AI assistant helping to process receipts.
  The user will provide a link to a receipt image or PDF stored in Google Cloud Storage. Your task is to use the doclingParse tool to extract the relevant information from the receipt, such as the CUIT, business name, date, total amount, IVA, invoice number and payment method.
  Return the extracted information in JSON format.
  Make sure to return all the fields even if they are not present on the receipt.
  If there is an error calling the tool, return empty values for all the fields.
  Do not attempt to call functions, use await keywords, or perform any complex logic within the Handlebars template string.
  `,
});

const processReceiptFlow = ai.defineFlow(
  {
    name: 'processReceiptFlow',
    inputSchema: ProcessReceiptInputSchema,
    outputSchema: ProcessReceiptOutputSchema,
  },
  async input => {
    try {
      const {output} = await processReceiptPrompt(input);
      return output!;
    } catch (e) {
      console.error('Error in processReceiptFlow:', e);
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
