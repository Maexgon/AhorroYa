
'use server';

import { initializeAdminApp } from '@/firebase/admin-config';
import { getFirestore } from 'firebase-admin/firestore';
import { defaultCategories } from '@/lib/default-categories';

interface SubscribeToPlanParams {
    planId: string;
    userId: string;
    userEmail: string;
    userDisplayName: string;
}

/**
 * Handles the entire subscription process for a new user using a single write batch.
 * This action uses the ADMIN SDK, so it has privileged access and bypasses security rules.
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
        const adminApp = initializeAdminApp();
        const adminFirestore = getFirestore(adminApp);
        const batch = adminFirestore.batch();

        // 1. Create Tenant
        const tenantRef = adminFirestore.collection("tenants").doc();
        const tenantData = {
            id: tenantRef.id,
            type: 'PERSONAL',
            name: `${userDisplayName}'s Space`,
            baseCurrency: 'ARS',
            createdAt: new Date().toISOString(),
            ownerUid: userId,
            status: 'active',
            settings: JSON.stringify({})
        };
        batch.set(tenantRef, tenantData);

        // 2. Create Membership
        const membershipRef = adminFirestore.collection("memberships").doc(`${tenantRef.id}_${userId}`);
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

        // 3. Update User with Tenant ID
        const userRef = adminFirestore.collection("users").doc(userId);
        batch.update(userRef, { tenantIds: [tenantRef.id] });

        // 4. Create License
        const licenseRef = adminFirestore.collection("licenses").doc();
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
        batch.set(licenseRef, licenseData);

        // 5. Create Default Categories and Subcategories
        defaultCategories.forEach((category, catIndex) => {
            const categoryId = adminFirestore.collection("categories").doc().id;
            const categoryRef = adminFirestore.collection("categories").doc(categoryId);
            batch.set(categoryRef, { id: categoryId, tenantId: tenantRef.id, name: category.name, color: category.color, order: catIndex });

            category.subcategories.forEach((subcategoryName, subCatIndex) => {
                const subcategoryId = adminFirestore.collection("subcategories").doc().id;
                const subcategoryRef = adminFirestore.collection("subcategories").doc(subcategoryId);
                batch.set(subcategoryRef, { id: subcategoryId, tenantId: tenantRef.id, categoryId: categoryId, name: subcategoryName, order: subCatIndex });
            });
        });
        
        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error("Error in subscribeToPlanAction:", error);
        return { success: false, error: `Error interno del servidor: ${error.message}` };
    }
}
