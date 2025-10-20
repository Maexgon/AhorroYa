'use server';

import { initializeAdminApp } from '@/firebase/admin-config';
import { defaultCategories } from '@/lib/default-categories';
import { getFirestore } from 'firebase-admin/firestore';

interface SubscribeToPlanParams {
    planId: string;
    userId: string;
    userEmail: string;
    userDisplayName: string;
}


/**
 * Handles the subscription and tenant setup process using the Firebase Admin SDK.
 * This is the definitive, secure, and robust way to handle this server-side logic.
 */
export async function subscribeToPlanAction(params: SubscribeToPlanParams): Promise<{ success: boolean; error?: string; }> {
    const { planId, userId, userEmail, userDisplayName } = params;

    console.log(`[Action Start] Subscribing user ${userId} to plan ${planId}.`);

    try {
        console.log('[Action Step] Initializing Firebase Admin SDK...');
        const adminApp = await initializeAdminApp();
        const firestore = getFirestore(adminApp);
        console.log('[Action Step] Admin SDK initialized. Preparing batch write...');

        const batch = firestore.batch();

        // 1. Create Tenant
        const tenantRef = firestore.collection('tenants').doc();
        const tenantData = {
            id: tenantRef.id,
            type: planId === 'familiar' || planId === 'empresa' ? planId.toUpperCase() : 'PERSONAL',
            name: `${userDisplayName}'s Space`,
            baseCurrency: 'ARS',
            createdAt: new Date().toISOString(),
            ownerUid: userId,
            status: 'active',
            settings: JSON.stringify({})
        };
        batch.set(tenantRef, tenantData);
        console.log(`[Action Batch] Added tenant ${tenantRef.id} creation to batch.`);

        // 2. Create Membership
        const membershipRef = firestore.collection('memberships').doc(`${tenantRef.id}_${userId}`);
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
        console.log(`[Action Batch] Added membership creation for user ${userId} to batch.`);


        // 3. Update User
        const userRef = firestore.collection('users').doc(userId);
        batch.update(userRef, { tenantIds: [tenantRef.id] });
        console.log(`[Action Batch] Added user update for ${userId} to batch.`);


        // 4. Create License
        const licenseRef = firestore.collection('licenses').doc();
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
        console.log(`[Action Batch] Added license creation for plan ${planId} to batch.`);


        // 5. Create Default Categories and Subcategories
        defaultCategories.forEach((category, catIndex) => {
            const categoryRef = firestore.collection('categories').doc();
            batch.set(categoryRef, { id: categoryRef.id, tenantId: tenantRef.id, name: category.name, color: category.color, order: catIndex });
            
            category.subcategories.forEach((subcategoryName, subCatIndex) => {
                const subcategoryRef = firestore.collection('subcategories').doc();
                batch.set(subcategoryRef, { id: subcategoryRef.id, tenantId: tenantRef.id, categoryId: categoryRef.id, name: subcategoryName, order: subCatIndex });
            });
        });
        console.log('[Action Batch] Added default categories and subcategories to batch.');

        
        console.log('[Action Commit] Committing batch write to Firestore...');
        await batch.commit();
        console.log('[Action Success] Batch commit successful. Account setup complete.');

        return { success: true };

    } catch (error: any) {
        console.error("[Action Error] subscribeToPlanAction failed:", error);
        // Log the full error for detailed debugging on the server
        console.error("Full Firebase Admin Error:", JSON.stringify(error, null, 2));
        return { success: false, error: `Ocurrió un error en el servidor al configurar tu cuenta. Código: ${error.code || 'UNKNOWN'}` };
    }
}
