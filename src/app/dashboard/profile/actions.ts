
'use server';

import { initializeAdminApp } from '@/firebase/admin-config';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';


export async function uploadAvatarAction(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
    const file = formData.get('file') as File;
    const uid = formData.get('uid') as string;

    if (!file || !uid) {
        return { success: false, error: 'Faltan datos para la subida.' };
    }

    try {
        const adminApp = await initializeAdminApp();
        const bucket = getStorage(adminApp).bucket();

        const filePath = `avatars/${uid}/${Date.now()}_${file.name}`;
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        const bucketFile = bucket.file(filePath);
        await bucketFile.save(fileBuffer, {
            metadata: {
                contentType: file.type,
            },
        });
        
        // Make the file public to get a downloadable URL
        await bucketFile.makePublic();
        const downloadURL = bucketFile.publicUrl();

        // Update user profile in Auth and Firestore
        const adminAuth = getAuth(adminApp);
        const adminFirestore = getFirestore(adminApp);

        await adminAuth.updateUser(uid, { photoURL: downloadURL });
        await adminFirestore.collection('users').doc(uid).update({ photoURL: downloadURL });

        return { success: true, url: downloadURL };

    } catch (error: any) {
        console.error('Error in uploadAvatarAction:', error);
        return { success: false, error: error.message || 'No se pudo subir la imagen.' };
    }
}
