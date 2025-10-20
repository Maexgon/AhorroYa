'use server';

import { initializeFirebaseServer } from '@/firebase/server-init';
import { doc, writeBatch, collection } from 'firebase/firestore';
import { defaultCategories } from '@/lib/default-categories';

interface SubscribeToPlanParams {
    planId: string;
    userId: string;
    userEmail: string;
    userDisplayName: string;
}

/**
 * Handles the subscription process using two sequential client SDK write batches
 * to avoid security rule race conditions.
 *
 * @param params - The user and plan details.
 * @returns An object indicating success or failure.
 */
export async function subscribeToPlanAction(params: SubscribeToPlanParams): Promise<{ success: boolean; error?: string; }> {
    const { planId, userId, userEmail, userDisplayName } = params;

    if (!planId || !userId || !userEmail) {
        return { success: false, error: "Faltan parámetros requeridos (plan, usuario o email)." };
    }

    try {
        const { firestore } = initializeFirebaseServer();

        // --- BATCH 1: Create Tenant, Membership, and update User ---
        const tenantRef = doc(collection(firestore, "tenants"));
        const userRef = doc(firestore, "users", userId);
        const membershipRef = doc(firestore, "memberships", `${tenantRef.id}_${userId}`);
        
        const initialBatch = writeBatch(firestore);

        // 1. Create Tenant
        const tenantData = {
            id: tenantRef.id,
            type: 'PERSONAL',
            name: `${userDisplayName}'s Space`,
            baseCurrency: 'ARS',
            createdAt: new Date().toISOString(),
            ownerUid: userId,
            status: 'pending', // Start as pending, activate in second batch
            settings: JSON.stringify({})
        };
        initialBatch.set(tenantRef, tenantData);

        // 2. Create Membership
        const membershipData = {
            tenantId: tenantRef.id,
            uid: userId,
            displayName: userDisplayName,
            email: userEmail,
            role: 'owner',
            status: 'active',
            joinedAt: new Date().toISOString(),
        };
        initialBatch.set(membershipRef, membershipData);

        // 3. Update User with Tenant ID
        initialBatch.update(userRef, { tenantIds: [tenantRef.id] });

        // Commit the first batch to establish membership
        await initialBatch.commit();


        // --- BATCH 2: Create License, Categories, and activate Tenant ---
        const setupBatch = writeBatch(firestore);
        
        // 4. Create License
        const licenseRef = doc(collection(firestore, "licenses"));
        const startDate = new Date();
        const endDate = new Date();
        if (planId === 'demo') {
            endDate.setDate(startDate.getDate() + 15);
        } else {
            endDate.setFullYear(startDate.getFullYear() + 1);
        }
        const licenseData = {
            id: licenseRef.id,
            tenantId: tenantRef.id,
            plan: planId,
            status: 'active',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            maxUsers: planId === 'familiar' ? 4 : (planId === 'empresa' ? 10 : 1),
        };
        setupBatch.set(licenseRef, licenseData);

        // 5. Create Default Categories and Subcategories
        defaultCategories.forEach((category, catIndex) => {
            const categoryRef = doc(collection(firestore, "categories"));
            setupBatch.set(categoryRef, { id: categoryRef.id, tenantId: tenantRef.id, name: category.name, color: category.color, order: catIndex });
            category.subcategories.forEach((subcategoryName, subCatIndex) => {
                const subcategoryRef = doc(collection(firestore, "subcategories"));
                setupBatch.set(subcategoryRef, { id: subcategoryRef.id, tenantId: tenantRef.id, categoryId: categoryRef.id, name: subcategoryName, order: subCatIndex });
            });
        });
        
        // 6. Activate Tenant
        setupBatch.update(tenantRef, { status: "active" });

        // Commit the second batch
        await setupBatch.commit();

        return { success: true };

    } catch (error: any) {
        console.error("Error in subscribeToPlanAction:", error);
        // The error from Firestore will be more useful here
        return { success: false, error: `Error de Firestore: ${error.message}` };
    }
}
