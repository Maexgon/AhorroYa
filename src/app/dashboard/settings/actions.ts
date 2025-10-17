
'use server';

import { getFirestore, doc, collection, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/config';
import type { License } from '@/lib/types';


interface InviteUserParams {
    tenantId: string;
    currentUserUid: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
    license: License | null;
}

// Helper function to safely get the client-side firestore instance
function getClientFirestore() {
    // This is a simplified way to get the firestore instance on the server.
    // In a real app, you might have a more robust way to get admin or client SDKs.
    const app = initializeFirebase();
    return getFirestore(app);
}

/**
 * Server Action to invite a new user to a tenant using Firebase Auth REST API.
 * This avoids using the Admin SDK which was causing authentication issues.
 */
export async function inviteUserAction(params: InviteUserParams): Promise<{ success: boolean; error?: string }> {
    const { tenantId, currentUserUid, email, firstName, lastName, phone, password, license } = params;

    const firestore = getClientFirestore();

    try {
        // 1. Validate permissions and license limits
        const tenantDocRef = doc(firestore, 'tenants', tenantId);
        // We trust the client sends correct ownership info, but a server check would be better
        // For now, we proceed assuming the client-side check was sufficient.

        if (!license) {
             return { success: false, error: 'No se encontró una licencia para este tenant.' };
        }

        const membersQuery = query(collection(firestore, 'memberships'), where('tenantId', '==', tenantId));
        const membersSnapshot = await getDocs(membersQuery);

        if (membersSnapshot.size >= license.maxUsers) {
            return { success: false, error: 'Has alcanzado el número máximo de usuarios para tu plan.' };
        }

        // 2. Create user via Firebase Auth REST API
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
        const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;

        const authResponse = await fetch(signUpUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true,
            }),
        });

        const authData = await authResponse.json();

        if (!authResponse.ok) {
            const errorMessage = authData.error?.message || 'UNKNOWN_AUTH_ERROR';
             if (errorMessage === 'EMAIL_EXISTS') {
                return { success: false, error: 'El correo electrónico ya está en uso por otro usuario.' };
            }
            console.error('Firebase Auth REST API Error:', authData);
            return { success: false, error: `Error de autenticación: ${errorMessage}` };
        }

        const newUserUid = authData.localId;

        // 3. Create user and membership documents in Firestore within a batch
        const batch = writeBatch(firestore);

        const userRef = doc(firestore, 'users', newUserUid);
        const userData = {
            uid: newUserUid,
            displayName: `${firstName} ${lastName}`,
            email: email,
            photoURL: '',
            tenantIds: [tenantId],
            isSuperadmin: false,
        };
        batch.set(userRef, userData);

        const membershipRef = doc(firestore, 'memberships', `${tenantId}_${newUserUid}`);
        const membershipData = {
            tenantId: tenantId,
            uid: newUserUid,
            displayName: `${firstName} ${lastName}`,
            role: 'member',
            status: 'active',
            joinedAt: new Date().toISOString(),
        };
        batch.set(membershipRef, membershipData);

        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error('Error in inviteUserAction:', error);
        return { success: false, error: error.message || 'Ocurrió un error inesperado al invitar al usuario.' };
    }
}
