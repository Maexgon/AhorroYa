
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


async function getServiceAccountToken() {
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
        scopes: [
            'https://www.googleapis.com/auth/cloud-platform',
            'https://www.googleapis.com/auth/firebase.database',
            'https://www.googleapis.com/auth/firebase.messaging',
            'https://www.googleapis.com/auth/identitytoolkit',
            'https://www.googleapis.com/auth/userinfo.email',
        ],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    return accessToken.token;
}

export async function getMembersAction(params: {
    tenantId: string;
    adminIdToken: string;
}): Promise<{ success: boolean; members?: Membership[], error?: string; }> {
    
    const { tenantId } = params;
    const projectId = firebaseConfig.projectId;

    if (!projectId) {
        return { success: false, error: "El ID del proyecto de Firebase no está configurado." };
    }

    try {
        const token = await getServiceAccountToken();
        if (!token) {
            return { success: false, error: "No se pudo obtener el token de la cuenta de servicio." };
        }

        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'memberships' }],
                    where: {
                        fieldFilter: {
                            field: { fieldPath: 'tenantId' },
                            op: 'EQUAL',
                            value: { stringValue: tenantId }
                        }
                    }
                }
            })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Error from Firestore REST API:", errorBody);
            throw new Error(errorBody.error?.message || `Error al consultar Firestore: ${response.statusText}`);
        }

        const queryResult = await response.json();
        
        const members = queryResult.map((doc: any) => {
            const fields = doc.document.fields;
            const formattedDoc: DocumentData = {};
            for (const key in fields) {
                const value = fields[key];
                if (value.stringValue) formattedDoc[key] = value.stringValue;
                else if (value.integerValue) formattedDoc[key] = parseInt(value.integerValue, 10);
                else if (value.doubleValue) formattedDoc[key] = value.doubleValue;
                else if (value.booleanValue) formattedDoc[key] = value.booleanValue;
                else if (value.timestampValue) formattedDoc[key] = value.timestampValue;
            }
            return formattedDoc as Membership;
        }).filter(Boolean);


        return { success: true, members };

    } catch (e: any) {
        console.error("Error in getMembersAction:", e);
        return { success: false, error: e.message };
    }
}
