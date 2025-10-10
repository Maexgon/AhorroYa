
'use server';

import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { processReceipt, type ProcessReceiptOutput } from '@/ai/flows/ocr-receipt-processing';
import { initializeFirebase } from '@/firebase/config';
import { getApp } from 'firebase/app';

// Initialize Firebase Admin for server-side operations
// This will automatically use service account credentials in a deployed environment
try {
  if (getApp()) initializeFirebase();
} catch (e) {
  initializeFirebase();
}

type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function uploadAndProcessReceipt(formData: FormData): Promise<ActionResponse<ProcessReceiptOutput>> {
  const file = formData.get('receipt') as File | null;
  const tenantId = formData.get('tenantId') as string;
  const userId = formData.get('userId') as string;

  if (!file || !tenantId || !userId) {
    return { success: false, error: 'Faltan datos para procesar el recibo.' };
  }

  try {
    const storage = getStorage();
    const filePath = `receipts/${tenantId}/${userId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, filePath);

    // 1. Upload file to Firebase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await uploadBytes(storageRef, fileBuffer, {
      contentType: file.type,
    });

    const gcsUri = `gs://${storageRef.bucket}/${storageRef.fullPath}`;

    // 2. Process the receipt using the AI flow
    const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
    const ocrResult = await processReceipt({
      gcsUri,
      tenantId,
      userId,
      fileType,
    });
    
    // Check if OCR result has any data
    const hasData = Object.values(ocrResult).some(value => value !== undefined && value !== null && value !== '' && value !== 0);

    if (!hasData) {
        return { success: false, error: 'La IA no pudo extraer datos del recibo. Por favor, ingrésalos manualmente.' };
    }

    return { success: true, data: ocrResult };

  } catch (error: any) {
    console.error('Error in uploadAndProcessReceipt:', error);
    return { success: false, error: error.message || 'Error desconocido en el servidor.' };
  }
}
