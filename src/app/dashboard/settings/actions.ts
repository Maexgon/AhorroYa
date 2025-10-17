
'use server';

import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/firebase/admin-config';

interface InviteUserParams {
    tenantId: string;
    currentUserUid: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
}

/**
 * Server Action to invite a new user to a tenant.
 * It creates a user in Firebase Auth, and corresponding documents in Firestore.
 */
export async function inviteUserAction(params: InviteUserParams): Promise<{ success: boolean; error?: string }> {
    
    try {
        const adminApp = await initializeAdminApp();
        const adminAuth = getAuth(adminApp);
        const adminFirestore = getFirestore(adminApp);

        const { tenantId, currentUserUid, email, firstName, lastName, phone, password } = params;

        // 1. Validate permissions and license limits
        const tenantDoc = await adminFirestore.collection('tenants').doc(tenantId).get();
        if (!tenantDoc.exists || tenantDoc.data()?.ownerUid !== currentUserUid) {
            return { success: false, error: 'No tienes permiso para realizar esta acción.' };
        }

        const licenseQuery = await adminFirestore.collection('licenses').where('tenantId', '==', tenantId).limit(1).get();
        if (licenseQuery.empty) {
            return { success: false, error: 'No se encontró una licencia para este tenant.' };
        }
        const license = licenseQuery.docs[0].data();

        const membersQuery = await adminFirestore.collection('memberships').where('tenantId', '==', tenantId).get();
        if (membersQuery.size >= license.maxUsers) {
            return { success: false, error: 'Has alcanzado el número máximo de usuarios para tu plan.' };
        }

        // 2. Check if user already exists in Firebase Auth
        try {
            await adminAuth.getUserByEmail(email);
            return { success: false, error: 'El correo electrónico ya está en uso por otro usuario.' };
        } catch (error: any) {
            if (error.code !== 'auth/user-not-found') {
                throw error; // Re-throw unexpected errors
            }
            // If user is not found, we can proceed.
        }
        
        // 3. Create user in Firebase Authentication
        const userRecord = await adminAuth.createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`,
            phoneNumber: phone || undefined,
        });

        // 4. Create user and membership documents in Firestore within a batch
        const batch = adminFirestore.batch();

        const userRef = adminFirestore.collection('users').doc(userRecord.uid);
        const userData = {
            uid: userRecord.uid,
            displayName: `${firstName} ${lastName}`,
            email: email,
            photoURL: '',
            tenantIds: [tenantId], // Start with the current tenant
            isSuperadmin: false,
        };
        batch.set(userRef, userData);

        const membershipRef = adminFirestore.collection('memberships').doc(`${tenantId}_${userRecord.uid}`);
        const membershipData = {
            tenantId: tenantId,
            uid: userRecord.uid,
            displayName: `${firstName} ${lastName}`,
            role: 'member', // All invited users are members
            status: 'active',
            joinedAt: new Date().toISOString(),
        };
        batch.set(membershipRef, membershipData);

        await batch.commit();

        // TODO: Send a beautiful HTML email to the user with their temp password.

        return { success: true };

    } catch (error: any) {
        console.error('Error in inviteUserAction:', error);
        // Provide a generic error message to the client
        return { success: false, error: error.message || 'Ocurrió un error inesperado al invitar al usuario.' };
    }
}
