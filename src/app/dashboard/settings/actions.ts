
'use server';

import { getFirestore, doc, collection, writeBatch, getDocs, query, where } from 'firebase/firestore';
import type { License, Membership } from '@/lib/types';
import { initializeFirebase } from '@/firebase/config';

interface InviteUserParams {
    tenantId: string;
    currentUserUid: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
    license: License | null;
    currentMemberCount: number;
}

// Helper function to get client-side Firestore instance
function getClientFirestore() {
    const app = initializeFirebase();
    return getFirestore(app);
}

/**
 * Server Action to invite a new user to a tenant using Firebase Auth REST API.
 * This approach avoids server-side SDK credential issues in certain environments.
 */
export async function inviteUserAction(params: InviteUserParams): Promise<{ success: boolean; error?: string; members?: Membership[] }> {
    const { tenantId, email, firstName, lastName, password, license, currentMemberCount } = params;

    const firestore = getClientFirestore();

    try {
        // 1. Validate license limits
        if (!license) {
            return { success: false, error: 'No se encontró una licencia para este tenant.' };
        }
        if (currentMemberCount >= license.maxUsers) {
            return { success: false, error: 'Has alcanzado el número máximo de usuarios para tu plan.' };
        }

        // 2. Create user via Firebase Auth REST API
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        if (!apiKey) {
            throw new Error("La clave de API de Firebase no está configurada en el servidor.");
        }
        
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                password: password,
                displayName: `${firstName} ${lastName}`,
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
        const membershipData: Membership = {
            tenantId: tenantId,
            uid: newUserUid,
            displayName: `${firstName} ${lastName}`,
            role: 'member',
            status: 'active',
            joinedAt: new Date().toISOString(),
        };
        batch.set(membershipRef, membershipData);

        await batch.commit();

        // 4. Fetch and return the updated list of members
        const membersQuery = query(collection(firestore, 'memberships'), where('tenantId', '==', tenantId));
        const membersSnapshot = await getDocs(membersQuery);
        const updatedMembers = membersSnapshot.docs.map(doc => doc.data() as Membership);

        return { success: true, members: updatedMembers };

    } catch (error: any) {
        console.error('Error in inviteUserAction:', error);
        return { success: false, error: error.message || 'Ocurrió un error inesperado.' };
    }
}
