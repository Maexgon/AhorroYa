'use server';

import { collection, doc, writeBatch } from 'firebase/firestore';
import { defaultCategories } from '@/lib/default-categories';
import { initializeFirebaseServer } from '@/firebase/server-init';

interface SubscribeToPlanParams {
    planId: string;
    userId: string;
    userEmail: string;
    userDisplayName: string;
}

/**
 * Handles the entire subscription process for a new user.
 * This action uses the CLIENT SDK within a server environment, acting on behalf of the user.
 * It creates the tenant, membership, license, and default categories in a single atomic batch.
 * This relies on security rules allowing a user to create their own resources.
 *
 * @param params - The user and plan details.
 * @returns An object indicating success or failure.
 */
export async function subscribeToPlanAction(params: SubscribeToPlanParams): Promise<{ success: boolean; error?: string; }> {
    const { planId, userId, userEmail, userDisplayName } = params;

    if (!planId || !userId) {
        return { success: false, error: 'El ID del plan y del usuario son requeridos.' };
    }

    try {
        // Initialize Firebase using the server-safe method.
        // This gives us a Firestore instance that can act on behalf of the user.
        const { firestore } = initializeFirebaseServer();

        const batch = writeBatch(firestore);

        // --- 1. Tenant ---
        const tenantRef = doc(collection(firestore, 'tenants'));
        const tenantId = tenantRef.id;
        batch.set(tenantRef, {
            id: tenantId,
            type: planId.toUpperCase(),
            name: `Mi Espacio`,
            baseCurrency: "ARS",
            createdAt: new Date().toISOString(),
            ownerUid: userId,
            status: "active", // Set to active directly
            settings: JSON.stringify({ quietHours: true, rollover: false }),
        });

        // --- 2. Membership ---
        // The ID is predictable and based on your security rules
        const membershipRef = doc(firestore, 'memberships', `${tenantId}_${userId}`);
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
        defaultCategories.forEach((category, catIndex) => {
            const categoryRef = doc(collection(firestore, "categories"));
            batch.set(categoryRef, { id: categoryRef.id, tenantId, name: category.name, color: category.color, order: catIndex });
            category.subcategories.forEach((subcategoryName, subCatIndex) => {
                const subcategoryRef = doc(collection(firestore, "subcategories"));
                batch.set(subcategoryRef, { id: subcategoryRef.id, tenantId, categoryId: categoryRef.id, name: subcategoryName, order: subCatIndex });
            });
        });

        // --- Commit the entire transaction ---
        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error("Error in subscribeToPlanAction: ", error);
        // The error will likely be a Firestore-level permission error now
        return { success: false, error: `Error en la suscripción: ${error.message}` };
    }
}
