
'use server';

import { collection, doc, writeBatch } from 'firebase/firestore';
import { defaultCategories } from '@/lib/default-categories';
import type { User as UserType } from '@/lib/types';
import { initializeFirebaseServer } from '@/firebase/server-init'; // Use the new server-side initializer

interface SubscribeToPlanParams {
    planId: string;
    userId: string;
}

export async function subscribeToPlanAction(params: SubscribeToPlanParams): Promise<{ success: boolean; error?: string; }> {
    const { planId, userId } = params;

    // Initialize Firebase using the server-side function
    const { firestore } = initializeFirebaseServer();

    try {
        const userRef = doc(firestore, "users", userId);
        
        const batch = writeBatch(firestore);

        // Generate a new tenant ID
        const newTenantRef = doc(collection(firestore, "tenants"));
        const tenantId = newTenantRef.id;

        // A) Create Tenant
        batch.set(newTenantRef, {
            id: tenantId,
            type: planId.toUpperCase(),
            name: `Mi Espacio`, // Generic name
            baseCurrency: "ARS",
            createdAt: new Date().toISOString(),
            ownerUid: userId,
            status: "pending", // Will be activated at the end
            settings: JSON.stringify({ quietHours: true, rollover: false }),
        });

        // B) Create Membership
        const membershipRef = doc(firestore, "memberships", `${tenantId}_${userId}`);
        batch.set(membershipRef, {
            tenantId: tenantId,
            uid: userId,
            role: 'owner',
            status: 'active',
            joinedAt: new Date().toISOString()
        });

        // C) Update User with Tenant ID
        batch.update(userRef, { tenantIds: [tenantId] });

        // D) Create Categories
        defaultCategories.forEach((category, catIndex) => {
            const categoryRef = doc(collection(firestore, "categories"));
            batch.set(categoryRef, { id: categoryRef.id, tenantId: tenantId, name: category.name, color: category.color, order: catIndex });

            category.subcategories.forEach((subcategoryName, subCatIndex) => {
                const subcategoryRef = doc(collection(firestore, "subcategories"));
                batch.set(subcategoryRef, { id: subcategoryRef.id, tenantId: tenantId, categoryId: categoryRef.id, name: subcategoryName, order: subCatIndex });
            });
        });
        
        // E) Create License
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
            id: licenseRef.id, tenantId: tenantId, plan: planId, status: 'active',
            startDate: startDate.toISOString(), endDate: endDate.toISOString(),
            maxUsers: maxUsersMapping[planId] ?? 1
        });
        
        // F) Activate Tenant
        batch.update(newTenantRef, { status: "active" });

        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error("[subscribeToPlanAction] ERROR CATCH:", error);
        return { success: false, error: `An unexpected error occurred: ${error.message} (Code: ${error.code})` };
    }
}
