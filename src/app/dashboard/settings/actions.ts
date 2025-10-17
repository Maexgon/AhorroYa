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
            tenantIds: [tenantId], // FIX: Include the tenantId in the user data
            isSuperadmin: false,
        };

        return { success: true, uid: authData.localId, userData: userData };

    } catch (error: any) {
        console.error('Error in inviteUserAction (fetch):', error);
        return { success: false, error: error.message || 'Ocurrió un error de red al contactar el servicio de autenticación.' };
    }
}
