
'use server';

import { initializeAdminApp } from '@/firebase/admin-config';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { defaultCategories } from '@/lib/default-categories';

interface SubscribeToPlanParams {
    planId: string;
    userId: string; 
}

/**
 * A secure server action to handle a user's subscription to a plan.
 * It performs all necessary checks and database writes with admin privileges.
 */
export async function subscribeToPlanAction(params: SubscribeToPlanParams): Promise<{ success: boolean; error?: string; }> {
    const { planId, userId } = params;

    if (!userId) {
        return { success: false, error: "ID de usuario no proporcionado." };
    }

    try {
        const adminApp = await initializeAdminApp();
        const adminAuth = getAuth(adminApp);
        const adminFirestore = getFirestore(adminApp);
        
        const userRecord = await adminAuth.getUser(userId);
        const user = {
            uid: userRecord.uid,
            displayName: userRecord.displayName || 'Usuario',
            email: userRecord.email || '',
            photoURL: userRecord.photoURL || null,
        };

        const userRef = adminFirestore.collection("users").doc(user.uid);
        const userSnap = await userRef.get();
        const existingTenantIds = userSnap.data()?.tenantIds || [];

        let tenantId: string;
        
        if (existingTenantIds.length === 0) {
            const tenantRef = adminFirestore.collection("tenants").doc();
            tenantId = tenantRef.id;

            const initialBatch = adminFirestore.batch();
            
            initialBatch.update(userRef, { tenantIds: FieldValue.arrayUnion(tenantId) });

            initialBatch.set(tenantRef, {
                id: tenantId, type: planId.toUpperCase(), name: `Espacio de ${user.displayName.split(' ')[0]}`,
                baseCurrency: "ARS", createdAt: new Date().toISOString(), ownerUid: user.uid,
                status: "pending",
                settings: JSON.stringify({ quietHours: true, rollover: false }),
            });

            const membershipRef = adminFirestore.collection("memberships").doc(`${tenantId}_${user.uid}`);
            initialBatch.set(membershipRef, {
                tenantId: tenantId, uid: user.uid, displayName: user.displayName, email: user.email,
                role: 'owner', status: 'active', joinedAt: new Date().toISOString()
            });

            await initialBatch.commit();
            
            const categoriesBatch = adminFirestore.batch();
            const categoriesCol = adminFirestore.collection("categories");
            const subcategoriesCol = adminFirestore.collection("subcategories");

            defaultCategories.forEach((category, catIndex) => {
                const categoryRef = categoriesCol.doc();
                categoriesBatch.set(categoryRef, { id: categoryRef.id, tenantId: tenantId, name: category.name, color: category.color, order: catIndex });

                category.subcategories.forEach((subcategoryName, subCatIndex) => {
                    const subcategoryRef = subcategoriesCol.doc();
                    categoriesBatch.set(subcategoryRef, { id: subcategoryRef.id, tenantId: tenantId, categoryId: categoryRef.id, name: subcategoryName, order: subCatIndex });
                });
            });
            await categoriesBatch.commit();
        } else {
            tenantId = existingTenantIds[0];
            const tenantSnap = await adminFirestore.collection("tenants").doc(tenantId).get();
            if (tenantSnap.data()?.status === 'active') {
                 return { success: false, error: 'Ya tienes un plan activo.' };
            }
        }
        
        const finalBatch = adminFirestore.batch();
        const licenseRef = adminFirestore.collection("licenses").doc();
        const startDate = new Date();
        const endDate = new Date();
        
        if (planId === 'demo') {
            endDate.setDate(startDate.getDate() + 15);
        } else {
            endDate.setFullYear(startDate.getFullYear() + 1);
        }

        const maxUsersMapping: { [key: string]: number } = { personal: 1, familiar: 4, empresa: 10, demo: 1 };

        finalBatch.set(licenseRef, {
            id: licenseRef.id, tenantId: tenantId, plan: planId, status: 'active',
            startDate: startDate.toISOString(), endDate: endDate.toISOString(),
            maxUsers: maxUsersMapping[planId] ?? 1,
            paymentId: `sim_${adminFirestore.collection("anything").doc().id}`,
        });

        const tenantRefToUpdate = adminFirestore.collection("tenants").doc(tenantId);
        finalBatch.update(tenantRefToUpdate, { status: "active" });
        
        await finalBatch.commit();

        return { success: true };

    } catch (error: any) {
        console.error("Error in subscribeToPlanAction:", error);
        return { success: false, error: `Ocurrió un error al crear la licencia. (${error.code || 'INTERNAL'})` };
    }
}
