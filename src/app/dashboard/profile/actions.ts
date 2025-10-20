'use server';

import { initializeAdminApp } from '@/firebase/admin-config';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import type { User as AdminUser } from 'firebase-admin/auth';

/**
 * Generates a signed URL for uploading a file to Firebase Storage.
 *
 * @param {string} userId - The ID of the user uploading the file.
 * @param {string} fileName - The name of the file to be uploaded.
 * @param {string} fileType - The MIME type of the file.
 * @returns {Promise<{ success: boolean; data?: { uploadUrl: string; publicUrl: string; }; error?: string; }>}
 */
export async function getSignedUploadUrlAction(
    userId: string,
    fileName: string,
    fileType: string
): Promise<{ success: boolean; data?: { uploadUrl: string; publicUrl: string; }; error?: string; }> {
    try {
        const adminApp = await initializeAdminApp();
        const bucket = getStorage(adminApp).bucket();

        const filePath = `avatars/${userId}/${fileName}`;
        const file = bucket.file(filePath);

        const [uploadUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            contentType: fileType,
        });

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        
        return { success: true, data: { uploadUrl, publicUrl } };

    } catch (e: any) {
        console.error('Error in getSignedUploadUrlAction:', e);
        return { success: false, error: e.message || 'Could not create signed URL.' };
    }
}


export async function deleteMemberAction(params: {
    adminIdToken: string;
    memberUid: string;
}): Promise<{ success: boolean; error?: string; }> {
    const { adminIdToken, memberUid } = params;

    try {
        const adminApp = await initializeAdminApp();
        const adminAuth = getAuth(adminApp);
        
        await adminAuth.deleteUser(memberUid);
        
        return { success: true };

    } catch (error: any) {
        console.error('Error in deleteMemberAction:', error);
         if (error.code === 'auth/user-not-found') {
            console.warn(`User ${memberUid} not found in Firebase Auth. May have been already deleted.`);
            return { success: true }; 
        }
        return { success: false, error: error.message || 'Ocurrió un error desconocido al eliminar al miembro de Authentication.' };
    }
}