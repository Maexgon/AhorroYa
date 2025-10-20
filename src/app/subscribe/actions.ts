
'use server';

import { initializeAdminApp } from '@/firebase/admin-config';
import { defaultCategories } from '@/lib/default-categories';

interface SubscribeToPlanParams {
    planId: string;
    userId: string;
    userEmail: string;
    userDisplayName: string;
}

/**
 * Handles the complete subscription and tenant setup process using the Firebase Admin SDK.
 * This Server Action is responsible for creating a user's entire environment in a single,
 * privileged, and atomic operation.
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
        const adminApp = await initializeAdminApp();
        const adminFirestore = adminApp.firestore();

        // Start a Firestore batch write.
        const batch = adminFirestore.batch();

        // 1. Create the Tenant document
        const tenantRef = adminFirestore.collection("tenants").doc();
        const tenantData = {
            id: tenantRef.id,
            type: 'PERSONAL', // Default to PERSONAL
            name: `${userDisplayName}'s Space`,
            baseCurrency: 'ARS',
            createdAt: new Date().toISOString(),
            ownerUid: userId,
            status: 'active', // Activate immediately
            settings: JSON.stringify({})
        };
        batch.set(tenantRef, tenantData);

        // 2. Create the Membership document
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

        // 3. Update the User document with the new tenantId
        const userRef = adminFirestore.collection("users").doc(userId);
        batch.update(userRef, { tenantIds: [tenantRef.id] });

        // 4. Create the License document
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
            const categoryRef = adminFirestore.collection("categories").doc();
            batch.set(categoryRef, { id: categoryRef.id, tenantId: tenantRef.id, name: category.name, color: category.color, order: catIndex });
            
            category.subcategories.forEach((subcategoryName, subCatIndex) => {
                const subcategoryRef = adminFirestore.collection("subcategories").doc();
                batch.set(subcategoryRef, { id: subcategoryRef.id, tenantId: tenantRef.id, categoryId: categoryRef.id, name: subcategoryName, order: subCatIndex });
            });
        });

        // Commit all operations atomically
        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error("Error in subscribeToPlanAction:", error);
        // Provide a more generic but helpful error message to the client
        return { success: false, error: `Ocurrió un error en el servidor al configurar tu cuenta. Código: ${error.code || 'UNKNOWN'}` };
    }
}
