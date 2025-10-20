
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
    
    console.log('[Action Start] subscribeToPlanAction. Params:', params);

    if (!planId || !userId || !userEmail) {
        const errorMsg = "Faltan parámetros requeridos (plan, usuario o email).";
        console.error(`[Action Fail] ${errorMsg}`);
        return { success: false, error: errorMsg };
    }

    try {
        console.log('[Step 1] Initializing Firebase Admin SDK...');
        const adminApp = initializeAdminApp();
        const adminFirestore = adminApp.firestore();
        console.log('[Step 1] Firebase Admin SDK initialized successfully.');

        const batch = adminFirestore.batch();
        console.log('[Step 2] Firestore batch created.');

        // 1. Create the Tenant document
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
        console.log('[Step 2a] Prepared tenant document:', tenantData);

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
        console.log('[Step 2b] Prepared membership document:', membershipData);

        // 3. Update the User document with the new tenantId
        const userRef = adminFirestore.collection("users").doc(userId);
        batch.update(userRef, { tenantIds: [tenantRef.id] });
        console.log(`[Step 2c] Prepared user update: tenantIds=[${tenantRef.id}]`);

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
        console.log('[Step 2d] Prepared license document:', licenseData);

        // 5. Create Default Categories and Subcategories
        console.log('[Step 2e] Preparing default categories and subcategories...');
        defaultCategories.forEach((category, catIndex) => {
            const categoryRef = adminFirestore.collection("categories").doc();
            batch.set(categoryRef, { id: categoryRef.id, tenantId: tenantRef.id, name: category.name, color: category.color, order: catIndex });
            
            category.subcategories.forEach((subcategoryName, subCatIndex) => {
                const subcategoryRef = adminFirestore.collection("subcategories").doc();
                batch.set(subcategoryRef, { id: subcategoryRef.id, tenantId: tenantRef.id, categoryId: categoryRef.id, name: subcategoryName, order: subCatIndex });
            });
        });
        console.log('[Step 2e] Default categories and subcategories prepared.');

        // Commit all operations atomically
        console.log('[Step 3] Committing batch write to Firestore...');
        await batch.commit();
        console.log('[Step 3] Batch commit successful!');

        return { success: true };

    } catch (error: any) {
        console.error("[Action Error] Error in subscribeToPlanAction:", error);
        console.error("[Action Error Detail] Code:", error.code);
        console.error("[Action Error Detail] Message:", error.message);
        console.error("[Action Error Detail] Stack:", error.stack);
        
        return { success: false, error: `Ocurrió un error en el servidor al configurar tu cuenta. Código: ${error.code || 'UNKNOWN'}` };
    }
}
