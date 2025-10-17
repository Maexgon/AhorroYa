
'use server';

import { getFirestore, doc, collection, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { initializeAdminApp } from '@/firebase/admin-config';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import type { License, Membership } from '@/lib/types';


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

// Helper function to safely get the admin firestore instance
async function getAdminFirestore() {
    const app = await initializeAdminApp();
    return app.firestore();
}
async function getAdminAuthSdk() {
    const app = await initializeAdminApp();
    return getAdminAuth(app);
}


/**
 * Server Action to invite a new user to a tenant using Firebase Auth REST API.
 */
export async function inviteUserAction(params: InviteUserParams): Promise<{ success: boolean; error?: string; members?: Membership[] }> {
    const { tenantId, currentUserUid, email, firstName, lastName, phone, password, license, currentMemberCount } = params;

    const firestore = await getAdminFirestore();
    const adminAuth = await getAdminAuthSdk();

    try {
        // 1. Validate license limits using the count passed from the client
        if (!license) {
             return { success: false, error: 'No se encontró una licencia para este tenant.' };
        }

        if (currentMemberCount >= license.maxUsers) {
            return { success: false, error: 'Has alcanzado el número máximo de usuarios para tu plan.' };
        }

        // 2. Create user via Firebase Admin SDK
        const userRecord = await adminAuth.createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`,
            emailVerified: false, // User will need to verify their email
        });
        
        const newUserUid = userRecord.uid;

        // 3. Create user and membership documents in Firestore within a batch
        const batch = firestore.batch();

        const userRef = firestore.collection('users').doc(newUserUid);
        const userData = {
            uid: newUserUid,
            displayName: `${firstName} ${lastName}`,
            email: email,
            photoURL: '',
            tenantIds: [tenantId],
            isSuperadmin: false,
        };
        batch.set(userRef, userData);

        const membershipRef = firestore.collection('memberships').doc(`${tenantId}_${newUserUid}`);
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

        // 4. Fetch the updated list of members
        const membersQuery = query(collection(firestore, 'memberships'), where('tenantId', '==', tenantId));
        const membersSnapshot = await getDocs(membersQuery);
        const updatedMembers = membersSnapshot.docs.map(doc => doc.data() as Membership);

        return { success: true, members: updatedMembers };

    } catch (error: any) {
        console.error('Error in inviteUserAction:', error);
         let errorMessage = error.message || 'Ocurrió un error inesperado al invitar al usuario.';
        if (error.code === 'auth/email-already-exists') {
            errorMessage = 'El correo electrónico ya está en uso por otro usuario.';
        }
        return { success: false, error: errorMessage };
    }
}
