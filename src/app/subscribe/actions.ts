'use server';

import { initializeFirebase, getSdks } from '@/firebase';
import { collection, doc, writeBatch, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { defaultCategories } from '@/lib/default-categories';
import type { User as UserType } from '@/lib/types';


interface SubscribeToPlanParams {
    planId: string;
    userId: string;
}

export async function subscribeToPlanAction(params: SubscribeToPlanParams): Promise<{ success: boolean; error?: string; }> {
    const { planId, userId } = params;

    const { firestore } = getSdks(initializeFirebase());

    try {
        const userRef = doc(firestore, "users", userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            return { success: false, error: "User profile not found. Please try registering again." };
        }
        
        const userData = userSnap.data() as UserType;
        const batch = writeBatch(firestore);

        let tenantId = userData.tenantIds?.[0];

        if (!tenantId) {
            const newTenantRef = doc(collection(firestore, "tenants"));
            tenantId = newTenantRef.id;

            // A) Create Tenant
            batch.set(newTenantRef, {
                id: tenantId,
                type: planId.toUpperCase(),
                name: `Espacio de ${userData.displayName.split(' ')[0]}`,
                baseCurrency: "ARS",
                createdAt: new Date().toISOString(),
                ownerUid: userId,
                status: "pending",
                settings: JSON.stringify({ quietHours: true, rollover: false }),
            });

            // B) Create Membership
            const membershipRef = doc(firestore, "memberships", `${tenantId}_${userId}`);
            batch.set(membershipRef, {
                tenantId: tenantId,
                uid: userId,
                displayName: userData.displayName,
                email: userData.email,
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
        }
        
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
        
        const tenantRefToUpdate = doc(firestore, "tenants", tenantId);
        batch.update(tenantRefToUpdate, { status: "active" });

        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error("[subscribeToPlanAction] ERROR CATCH:", error);
        return { success: false, error: `An unexpected error occurred: ${error.message} (Code: ${error.code})` };
    }
}