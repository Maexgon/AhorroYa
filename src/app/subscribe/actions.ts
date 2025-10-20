
'use server';

import { collection, doc, writeBatch, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { defaultCategories } from '@/lib/default-categories';
import { initializeFirebaseServer } from '@/firebase/server-init';
import { initializeAdminApp } from '@/firebase/admin-config';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

interface SubscribeToPlanParams {
    planId: string;
    userId: string;
    userEmail: string;
    userDisplayName: string;
}

/**
 * Creates the core tenant and membership using the Admin SDK to bypass
 * the initial chicken-and-egg security rule problem.
 * This should only be called once when a user subscribes for the first time.
 * @returns The new tenantId.
 */
export async function createInitialTenantAndMembershipAction(params: {
    userId: string;
    userEmail: string;
    userDisplayName: string;
    planId: string;
}): Promise<{ success: boolean; tenantId?: string; error?: string; }> {
    const { userId, userEmail, userDisplayName, planId } = params;

    try {
        await initializeAdminApp();
        const adminFirestore = getAdminFirestore();
        const batch = adminFirestore.batch();

        // 1. Create Tenant
        const tenantRef = adminFirestore.collection('tenants').doc();
        const tenantId = tenantRef.id;
        batch.set(tenantRef, {
            id: tenantId,
            type: planId.toUpperCase(),
            name: `Mi Espacio`,
            baseCurrency: "ARS",
            createdAt: new Date().toISOString(),
            ownerUid: userId,
            status: "pending",
            settings: JSON.stringify({ quietHours: true, rollover: false }),
        });

        // 2. Create Membership
        const membershipRef = adminFirestore.collection('memberships').doc(`${tenantId}_${userId}`);
        batch.set(membershipRef, {
            tenantId: tenantId,
            uid: userId,
            displayName: userDisplayName,
            email: userEmail,
            role: 'owner',
            status: 'active',
            joinedAt: new Date().toISOString()
        });

        // 3. Update User with Tenant ID
        const userDocRef = adminFirestore.collection('users').doc(userId);
        batch.update(userDocRef, { tenantIds: [tenantId] });

        await batch.commit();

        return { success: true, tenantId: tenantId };

    } catch (error: any) {
        console.error("Error in createInitialTenantAndMembershipAction: ", error);
        return { success: false, error: `Error creating tenant: ${error.message}` };
    }
}


export async function subscribeToPlanAction(params: SubscribeToPlanParams): Promise<{ success: boolean; error?: string; }> {
    const { planId, userId } = params;

    if (!planId || !userId) {
        return { success: false, error: 'El ID del plan y del usuario son requeridos.' };
    }

    try {
        const { firestore } = initializeFirebaseServer(); // Uses client SDK context
        const userDocRef = doc(firestore, 'users', userId);
        
        // Check if user already has a tenant. If so, something is wrong.
        const userDocSnap = await getDocs(query(collection(firestore, 'users'), where('uid', '==', userId)));
        if (!userDocSnap.empty) {
            const userData = userDocSnap.docs[0].data();
            if (userData.tenantIds && userData.tenantIds.length > 0) {
                 // User already has a tenant, so we just need to ensure the license is correct.
                 // This might happen if the initial creation succeeded but the second part failed.
                 const tenantId = userData.tenantIds[0];
                 const licenseQuery = query(collection(firestore, 'licenses'), where('tenantId', '==', tenantId));
                 const licenseSnap = await getDocs(licenseQuery);
                 if (!licenseSnap.empty) {
                     console.log("User already has a tenant and license. Skipping creation.");
                     return { success: true };
                 }
            }
        }
        
        // Step 1: Create Tenant and Membership with Admin privileges
        const initialResult = await createInitialTenantAndMembershipAction(params);
        if (!initialResult.success || !initialResult.tenantId) {
            return { success: false, error: initialResult.error || "Failed to create initial tenant." };
        }
        const tenantId = initialResult.tenantId;

        // Step 2: Create the rest of the resources with user's permissions
        const batch = writeBatch(firestore);

        // Create Categories & Subcategories
        defaultCategories.forEach((category, catIndex) => {
            const categoryRef = doc(collection(firestore, "categories"));
            batch.set(categoryRef, { id: categoryRef.id, tenantId, name: category.name, color: category.color, order: catIndex });
            category.subcategories.forEach((subcategoryName, subCatIndex) => {
                const subcategoryRef = doc(collection(firestore, "subcategories"));
                batch.set(subcategoryRef, { id: subcategoryRef.id, tenantId, categoryId: categoryRef.id, name: subcategoryName, order: subCatIndex });
            });
        });

        // Create License
        const licenseRef = doc(collection(firestore, "licenses"));
        const startDate = new Date();
        const endDate = new Date();
        if (planId === 'demo') {
            endDate.setDate(startDate.getDate() + 15);
        } else {
            endDate.setFullYear(startDate.getFullYear() + 1);
        }
        const maxUsersMapping: { [key: string]: number } = { personal: 1, familiar: 4, empresa: 10, demo: 1 };
        batch.set(licenseRef, {
            id: licenseRef.id, tenantId, plan: planId, status: 'active',
            startDate: startDate.toISOString(), endDate: endDate.toISOString(),
            maxUsers: maxUsersMapping[planId] ?? 1
        });
        
        // Set Tenant to Active
        const tenantClientRef = doc(firestore, 'tenants', tenantId);
        batch.update(tenantClientRef, { status: "active" });

        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error("Error in subscribeToPlanAction: ", error);
        return { success: false, error: `Error: ${error.message}` };
    }
}
