'use server';

import { collection, doc, writeBatch, getDoc, updateDoc } from 'firebase/firestore';
import { defaultCategories } from '@/lib/default-categories';
import { initializeFirebaseServer } from '@/firebase/server-init';

interface SubscribeToPlanParams {
    planId: string;
    userId: string;
    userEmail: string;
    userDisplayName: string;
}

export async function subscribeToPlanAction(params: SubscribeToPlanParams): Promise<{ success: boolean; error?: string; }> {
    const { planId, userId, userEmail, userDisplayName } = params;

    if (!planId || !userId) {
        return { success: false, error: 'El ID del plan y del usuario son requeridos.' };
    }

    try {
        const { firestore } = initializeFirebaseServer();
        const batch = writeBatch(firestore);
        
        // 1. Create Tenant
        const tenantRef = doc(collection(firestore, 'tenants'));
        const tenantId = tenantRef.id;
        batch.set(tenantRef, {
            id: tenantId,
            type: planId.toUpperCase(),
            name: `Mi Espacio`,
            baseCurrency: "ARS",
            createdAt: new Date().toISOString(),
            ownerUid: userId,
            status: "pending", // Will be activated at the end
            settings: JSON.stringify({ quietHours: true, rollover: false }),
        });

        // 2. Create Membership
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

        // 3. Update User with Tenant ID
        const userDocRef = doc(firestore, 'users', userId);
        batch.update(userDocRef, { tenantIds: [tenantId] });

        // 4. Create Categories & Subcategories
        defaultCategories.forEach((category, catIndex) => {
            const categoryRef = doc(collection(firestore, "categories"));
            batch.set(categoryRef, { id: categoryRef.id, tenantId, name: category.name, color: category.color, order: catIndex });
            category.subcategories.forEach((subcategoryName, subCatIndex) => {
                const subcategoryRef = doc(collection(firestore, "subcategories"));
                batch.set(subcategoryRef, { id: subcategoryRef.id, tenantId, categoryId: categoryRef.id, name: subcategoryName, order: subCatIndex });
            });
        });

        // 5. Create License
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
        
        // 6. Set Tenant to Active
        batch.update(tenantRef, { status: "active" });

        // Commit all changes at once
        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error("Error in subscribeToPlanAction: ", error);
        return { success: false, error: `Error: ${error.message}` };
    }
}
