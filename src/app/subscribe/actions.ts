
'use client';

import { initializeFirebase } from '@/firebase/config';
import { defaultCategories } from '@/lib/default-categories';
import { getFirestore, writeBatch, doc, collection } from 'firebase/firestore';

interface SubscribeToPlanParams {
    planId: string;
    userId: string;
    userEmail: string;
    userDisplayName: string;
}

/**
 * Step 1 of Subscription: Creates the core Tenant and Membership.
 * @returns An object with success status and the new tenantId, or an error.
 */
export async function createInitialTenantAndMembershipAction(params: Omit<SubscribeToPlanParams, 'planId'>): Promise<{ success: boolean; tenantId?: string; error?: string; }> {
    const { userId, userEmail, userDisplayName } = params;

    try {
        const firebaseApp = initializeFirebase();
        const firestore = getFirestore(firebaseApp);
        const batch = writeBatch(firestore);

        const tenantRef = doc(collection(firestore, 'tenants'));
        const tenantData = {
            id: tenantRef.id,
            type: 'PERSONAL',
            name: `${userDisplayName}'s Space`,
            baseCurrency: 'ARS',
            createdAt: new Date().toISOString(),
            ownerUid: userId,
            status: 'pending',
            settings: JSON.stringify({})
        };
        batch.set(tenantRef, tenantData);

        const membershipRef = doc(firestore, 'memberships', `${tenantRef.id}_${userId}`);
        const membershipData = {
            tenantId: tenantRef.id,
            uid: userId,
            displayName: userDisplayName,
            email: userEmail,
            role: 'owner',
            status: 'active',
            joinedAt: new Date().toISOString(),
        };
        batch.set(membershipRef, membershipData);
        
        await batch.commit();

        return { success: true, tenantId: tenantRef.id };

    } catch (error: any) {
        console.error("[Action Error] createInitialTenantAndMembershipAction failed:", error);
        return { success: false, error: `Ocurrió un error en el servidor al crear el tenant. Código: ${error.code || 'UNKNOWN'}` };
    }
}


/**
 * Step 2 of Subscription: Creates the License and default Categories.
 * @returns An object indicating success or failure.
 */
export async function createLicenseAndCategoriesAction(params: { planId: string, tenantId: string }): Promise<{ success: boolean; error?: string; }> {
    const { planId, tenantId } = params;

    try {
        const firebaseApp = initializeFirebase();
        const firestore = getFirestore(firebaseApp);
        const batch = writeBatch(firestore);
        
        const licenseRef = doc(collection(firestore, 'licenses'));
        const startDate = new Date();
        const endDate = new Date();
        if (planId === 'demo') {
            endDate.setDate(startDate.getDate() + 15);
        } else {
            endDate.setFullYear(startDate.getFullYear() + 1);
        }
        const licenseData = {
            id: licenseRef.id,
            tenantId: tenantId,
            plan: planId,
            status: 'active',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            maxUsers: planId === 'familiar' ? 4 : (planId === 'empresa' ? 10 : 1),
        };
        batch.set(licenseRef, licenseData);

        defaultCategories.forEach((category, catIndex) => {
            const categoryRef = doc(collection(firestore, 'categories'));
            batch.set(categoryRef, { id: categoryRef.id, tenantId: tenantId, name: category.name, color: category.color, order: catIndex });
            
            category.subcategories.forEach((subcategoryName, subCatIndex) => {
                const subcategoryRef = doc(collection(firestore, 'subcategories'));
                batch.set(subcategoryRef, { id: subcategoryRef.id, tenantId: tenantId, categoryId: categoryRef.id, name: subcategoryName, order: subCatIndex });
            });
        });
        
        const tenantRef = doc(firestore, 'tenants', tenantId);
        batch.update(tenantRef, { status: "active" });

        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error("[Action Error] createLicenseAndCategoriesAction failed:", error);
        return { success: false, error: `Ocurrió un error al crear la licencia y categorías. Código: ${error.code || 'UNKNOWN'}` };
    }
}
