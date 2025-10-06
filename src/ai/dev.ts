import { config } from 'dotenv';
config();

import '@/ai/flows/ocr-receipt-processing.ts';
import '@/ai/flows/suggest-budget-reallocations.ts';