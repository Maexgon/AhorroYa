
'use server';

import type { Membership } from '@/lib/types';
import { initializeAdminApp } from '@/firebase/admin-config';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { headers } from 'next/headers';


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
            tenantIds: [tenantId], // <-- CRITICAL FIX: Include tenantId
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
    tenantId: string;
    memberUid: string;
}): Promise<{ success: boolean; error?: string; }> {
    const { tenantId, memberUid } = params;
    const headersList = headers();
    const idToken = headersList.get('Authorization')?.split('Bearer ')[1];

    if (!idToken) {
        return { success: false, error: "No autorizado. Token de autenticación no proporcionado." };
    }

    try {
        const adminApp = await initializeAdminApp();
        const adminAuth = getAuth(adminApp);
        const adminFirestore = getFirestore(adminApp);
        
        // 1. Verify the caller's token and get their UID
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const callerUid = decodedToken.uid;

        // 2. Fetch tenant to verify ownership
        const tenantRef = adminFirestore.collection('tenants').doc(tenantId);
        const tenantSnap = await tenantRef.get();

        if (!tenantSnap.exists) {
            return { success: false, error: "El tenant especificado no existe." };
        }
        const tenantData = tenantSnap.data();

        // 3. SECURITY CHECK: Ensure the caller is the owner of the tenant
        if (tenantData?.ownerUid !== callerUid) {
            return { success: false, error: "Permiso denegado. Solo el propietario puede eliminar miembros." };
        }

        // 4. SECURITY CHECK: Prevent owner from deleting themselves
        if (callerUid === memberUid) {
            return { success: false, error: "No puedes eliminarte a ti mismo como propietario." };
        }

        // 5. Fetch the membership to ensure the member belongs to this tenant
        const membershipRef = adminFirestore.collection('memberships').doc(`${tenantId}_${memberUid}`);
        const membershipSnap = await membershipRef.get();
        if (!membershipSnap.exists) {
            return { success: false, error: "El miembro no pertenece a este tenant." };
        }

        // --- If all checks pass, proceed with deletion ---
        const batch = adminFirestore.batch();
        const userRef = adminFirestore.collection('users').doc(memberUid);
        
        // Delete Firestore documents
        batch.delete(membershipRef);
        batch.delete(userRef);
        
        await batch.commit();

        // Delete from Firebase Auth
        await adminAuth.deleteUser(memberUid);
        
        return { success: true };

    } catch (error: any) {
        console.error('Error in deleteMemberAction:', error);
         if (error.code === 'auth/user-not-found') {
            console.warn(`User ${memberUid} not found in Firebase Auth. May have been already deleted.`);
            return { success: true }; // Consider it a success if the user is already gone
        }
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
            return { success: false, error: "Tu sesión ha expirado o es inválida. Por favor, inicia sesión de nuevo." };
        }
        return { success: false, error: error.message || 'Ocurrió un error desconocido al eliminar al miembro.' };
    }
}
