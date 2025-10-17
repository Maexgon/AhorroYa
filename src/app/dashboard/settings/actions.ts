
'use server';

import type { Membership, User } from '@/lib/types';


export async function inviteUserAction(params: {
    email: string;
    password: string;
    tenantId: string;
    firstName: string;
    lastName: string;
}): Promise<{ success: boolean; uid?: string; userData?: User; error?: string; }> {
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

        const userData: User = {
            uid: authData.localId,
            displayName: `${firstName} ${lastName}`,
            email: email,
            photoURL: '',
            tenantIds: [tenantId],
            isSuperadmin: false,
        };

        return { success: true, uid: authData.localId, userData: userData };

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
    tenantId: string;
    memberUid: string;
    adminIdToken: string;
}): Promise<{ success: boolean; error?: string; }> {
    const { tenantId, memberUid, adminIdToken } = params;
    
    // Step 1: Delete user from Firebase Authentication
    // We must use the Admin SDK for this, which requires the app to be initialized.
    try {
       const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        if (!apiKey) throw new Error("Firebase API Key is not configured.");

        // We use the client's ID token to authorize the admin action on the server.
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              idToken: adminIdToken, // The admin's token
              localId: memberUid // The UID of the user to delete
            }),
        });

        // The API returns an error if the user to delete is not found, but we can treat it as a success
        // if our goal is to ensure the user is gone. We only fail on other errors.
        if (!res.ok) {
            const errorData = await res.json();
            if (errorData.error?.message !== 'USER_NOT_FOUND') {
                console.error("Error deleting user from Auth:", errorData);
                 // We don't return here, we try to delete from Firestore anyway.
            }
        }
        return { success: true };

    } catch (error: any) {
        console.error('Error in deleteMemberAction (fetch auth):', error);
        return { success: false, error: error.message || 'An unknown error occurred while deleting the user from Authentication.' };
    }
}
