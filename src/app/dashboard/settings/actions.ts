
'use server';

import { initializeAdminApp } from '@/firebase/admin-config';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

interface MemberActionParams {
    tenantId: string;
    targetUserId: string;
    actingUserId: string;
}

/**
 * Checks if the acting user is the owner of the tenant.
 * Throws an error if not authorized.
 */
async function verifyOwner(firestore: FirebaseFirestore.Firestore, tenantId: string, actingUserId: string) {
    const tenantRef = firestore.collection('tenants').doc(tenantId);
    const tenantDoc = await tenantRef.get();
    if (!tenantDoc.exists || tenantDoc.data()?.ownerUid !== actingUserId) {
        throw new Error('Unauthorized: Only the tenant owner can perform this action.');
    }
}

/**
 * Updates the role of a member within a tenant.
 * Only the tenant owner can perform this action.
 */
export async function updateMemberRoleAction(params: MemberActionParams & { newRole: 'admin' | 'member' }): Promise<{ success: boolean; error?: string }> {
    const { tenantId, targetUserId, actingUserId, newRole } = params;

    try {
        const adminApp = await initializeAdminApp();
        const firestore = getFirestore(adminApp);
        
        await verifyOwner(firestore, tenantId, actingUserId);

        const membershipId = `${tenantId}_${targetUserId}`;
        const membershipRef = firestore.collection('memberships').doc(membershipId);

        const memberDoc = await membershipRef.get();
        if (!memberDoc.exists) {
            return { success: false, error: 'Member not found.' };
        }
        
        if (memberDoc.data()?.role === 'owner') {
             return { success: false, error: 'The tenant owner role cannot be changed.' };
        }

        await membershipRef.update({ role: newRole });
        
        return { success: true };

    } catch (error: any) {
        console.error("Error in updateMemberRoleAction:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Deletes a member from a tenant.
 * Only the tenant owner can perform this action.
 */
export async function deleteMemberAction(params: MemberActionParams): Promise<{ success: boolean; error?: string }> {
    const { tenantId, targetUserId, actingUserId } = params;
    
     try {
        const adminApp = await initializeAdminApp();
        const firestore = getFirestore(adminApp);
        const auth = getAuth(adminApp);

        await verifyOwner(firestore, tenantId, actingUserId);

        const membershipId = `${tenantId}_${targetUserId}`;
        const membershipRef = firestore.collection('memberships').doc(membershipId);
        
        const memberDoc = await membershipRef.get();
         if (!memberDoc.exists) {
            return { success: false, error: 'Member not found.' };
        }
        if (memberDoc.data()?.role === 'owner') {
             return { success: false, error: 'The tenant owner cannot be deleted.' };
        }

        // Delete Firestore membership document
        await membershipRef.delete();
        
        // Optionally, also delete the user's auth account if they don't belong to other tenants
        // For simplicity and safety, we will only disable the user for now.
        await auth.updateUser(targetUserId, { disabled: true });


        return { success: true };
    } catch (error: any) {
        console.error("Error in deleteMemberAction:", error);
        return { success: false, error: error.message };
    }
}
