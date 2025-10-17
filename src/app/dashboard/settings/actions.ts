
'use server';

import type { Membership } from '@/lib/types';
import { getFirestore, query, collection, where, getDocs, type DocumentData } from 'firebase/firestore';
import { initializeAdminApp } from '@/firebase/admin-config';
import { getAuth } from 'firebase-admin/auth';
import { firebaseConfig } from '@/firebase/config';


export async function inviteUserAction(params: {
    email: string;
    password: string;
    tenantId: string;
    firstName: string;
    lastName: string;
}): Promise<{ success: boolean; data?: {uid: string, displayName: string, email: string, tenantIds: string[]}; error?: string; }> {
    const { email, password, tenantId, firstName, lastName } = params;

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
        const errorMessage = "La clave de API de Firebase no está configurada en el servidor.";
        console.error(errorMessage);
        return { success: false, error: errorMessage };
    }
    
    try {
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                password: password,
                returnSecureToken: true,
            }),
        });

        const authData = await res.json();

        if (!res.ok) {
            const errorMsg = authData.error?.message || 'Ocurrió un error desconocido al crear el usuario.';
             if (errorMsg === 'EMAIL_EXISTS') {
                 return { success: false, error: 'El correo electrónico ya está en uso por otro usuario.' };
            }
            return { success: false, error: errorMsg };
        }
        
        const displayName = `${firstName} ${lastName}`;
        const userData = {
            uid: authData.localId,
            displayName,
            email,
            photoURL: '',
            tenantIds: [tenantId],
        };

        return { success: true, data: userData };

    } catch (error: any) {
        console.error('Error in inviteUserAction (fetch):', error);
        return { success: false, error: error.message || 'Ocurrió un error de red al contactar el servicio de autenticación.' };
    }
}


export async function sendInvitationEmailAction(email: string): Promise<{ success: boolean; error?: string; }> {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
        const errorMessage = "La clave de API de Firebase no está configurada en el servidor.";
        console.error(errorMessage);
        return { success: false, error: errorMessage };
    }

    try {
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requestType: 'PASSWORD_RESET',
                email: email,
            }),
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            const errorMsg = errorData.error?.message || 'No se pudo enviar el correo de invitación.';
             if (errorMsg === 'EMAIL_NOT_FOUND') {
                return { success: false, error: 'El usuario fue creado en autenticación, pero el correo de invitación no se pudo enviar porque el email no fue encontrado. Contacte a soporte.' };
            }
            return { success: false, error: errorMsg };
        }
        
        return { success: true };

    } catch (error: any) {
        console.error('Error in sendInvitationEmailAction (fetch):', error);
        return { success: false, error: error.message || 'Ocurrió un error de red al enviar la invitación.' };
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
        
        // Before deleting user from Auth, make sure Firestore docs are deleted
        // The client-side logic will now handle Firestore deletions.
        // This action only handles Auth deletion.

        await adminAuth.deleteUser(memberUid);
        
        return { success: true };

    } catch (error: any) {
        console.error('Error in deleteMemberAction:', error);
         if (error.code === 'auth/user-not-found') {
            console.warn(`User ${memberUid} not found in Firebase Auth. May have been already deleted.`);
            // Return success because the desired state (user doesn't exist in Auth) is achieved.
            return { success: true }; 
        }
        return { success: false, error: error.message || 'Ocurrió un error desconocido al eliminar al miembro de Authentication.' };
    }
}
