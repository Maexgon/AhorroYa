'use server';

import { collection, doc, writeBatch, updateDoc } from 'firebase/firestore';
import { defaultCategories } from '@/lib/default-categories';
import { initializeFirebaseServer } from '@/firebase/server-init';

interface SubscribeToPlanParams {
    planId: string;
    userId: string;
    userEmail: string;
    userDisplayName: string;
}

/**
 * Handles the entire subscription process for a new user using a single write batch.
 * This action uses the CLIENT SDK within a server environment, acting on behalf of the user.
 * It relies on security rules allowing a user to create their own resources.
 *
 * @param params - The user and plan details.
 * @returns An object indicating success or failure.
 */
export async function subscribeToPlanAction(params: SubscribeToPlanParams): Promise<{ success: boolean; error?: string; }> {
    const { planId, userId, userEmail, userDisplayName } = params;
    console.log('[ACTION START] subscribeToPlanAction triggered for user:', userId, 'with plan:', planId);


    if (!planId || !userId) {
        const errorMsg = 'El ID del plan y del usuario son requeridos.';
        console.error('[ACTION FAIL]', errorMsg);
        return { success: false, error: errorMsg };
    }

    try {
        console.log('[ACTION STEP] Initializing Firebase for server...');
        const { firestore } = initializeFirebaseServer();
        console.log('[ACTION STEP] Firebase initialized. Creating write batch.');

        const batch = writeBatch(firestore);

        // --- 1. Tenant ---
        const tenantRef = doc(collection(firestore, 'tenants'));
        const tenantId = tenantRef.id;
        console.log('[ACTION STEP] Defining Tenant creation. Tenant ID:', tenantId);
        batch.set(tenantRef, {
            id: tenantId,
            type: planId.toUpperCase(),
            name: `Mi Espacio`,
            baseCurrency: "ARS",
            createdAt: new Date().toISOString(),
            ownerUid: userId,
            status: "active",
            settings: JSON.stringify({ quietHours: true, rollover: false }),
        });

        // --- 2. Membership ---
        const membershipRef = doc(firestore, 'memberships', `${tenantId}_${userId}`);
        console.log('[ACTION STEP] Defining Membership creation for user:', userId);
        batch.set(membershipRef, {
            tenantId: tenantId,
            uid: userId,
            displayName: userDisplayName,
            email: userEmail,
            role: 'owner',
            status: 'active',
            joinedAt: new Date().toISOString()
        });

        // --- 3. User Document Update ---
        const userRef = doc(firestore, 'users', userId);
        console.log('[ACTION STEP] Defining User document update for user:', userId);
        batch.update(userRef, { tenantIds: [tenantId] });
        
        // --- 4. License ---
        const licenseRef = doc(collection(firestore, "licenses"));
        const startDate = new Date();
        const endDate = new Date();
        const maxUsersMapping: { [key: string]: number } = { personal: 1, familiar: 4, empresa: 10, demo: 1 };
        
        if (planId === 'demo') {
            endDate.setDate(startDate.getDate() + 15);
        } else {
            endDate.setFullYear(startDate.getFullYear() + 1);
        }
        console.log('[ACTION STEP] Defining License creation for tenant:', tenantId);
        batch.set(licenseRef, {
            id: licenseRef.id,
            tenantId: tenantId,
            plan: planId,
            status: 'active',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            maxUsers: maxUsersMapping[planId] ?? 1
        });

        // --- 5. Default Categories & Subcategories ---
        console.log('[ACTION STEP] Defining default Categories and Subcategories creation...');
        defaultCategories.forEach((category, catIndex) => {
            const categoryRef = doc(collection(firestore, "categories"));
            batch.set(categoryRef, { id: categoryRef.id, tenantId, name: category.name, color: category.color, order: catIndex });
            category.subcategories.forEach((subcategoryName, subCatIndex) => {
                const subcategoryRef = doc(collection(firestore, "subcategories"));
                batch.set(subcategoryRef, { id: subcategoryRef.id, tenantId, categoryId: categoryRef.id, name: subcategoryName, order: subCatIndex });
            });
        });
        console.log('[ACTION STEP] All batch operations defined.');

        // --- Commit the entire transaction ---
        console.log('[ACTION COMMIT] Committing batch...');
        await batch.commit();
        console.log('[ACTION SUCCESS] Batch committed successfully.');

        return { success: true };

    } catch (error: any) {
        console.error("[ACTION FAIL] Error in subscribeToPlanAction:", error.name, error.message, error.code);
        return { success: false, error: `Error en la suscripción: ${error.message}` };
    }
}