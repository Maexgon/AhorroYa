
'use server';

import { initializeAdminApp } from '@/firebase/admin-config';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { headers } from 'next/headers';
import { defaultCategories } from '@/lib/default-categories';

interface SubscribeToPlanParams {
    planId: string;
}

/**
 * A secure server action to handle a user's subscription to a plan.
 * It performs all necessary checks and database writes with admin privileges.
 * 
 * - Verifies the calling user's authentication token from the request headers.
 * - Checks if a tenant already exists for the user.
 * - If not, it creates the User, Tenant, Membership, and default Categories.
 * - Creates a License document based on the selected plan.
 * - Activates the Tenant.
 */
export async function subscribeToPlanAction(params: SubscribeToPlanParams): Promise<{ success: boolean; error?: string; }> {
    const { planId } = params;
    const headersList = headers();
    const idToken = headersList.get('Authorization')?.split('Bearer ')[1];

    if (!idToken) {
        return { success: false, error: "Token de autenticación no proporcionado." };
    }

    try {
        const adminApp = await initializeAdminApp();
        const adminAuth = getAuth(adminApp);
        const adminFirestore = getFirestore(adminApp);
        
        // 1. Verify user token
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const user = {
            uid: decodedToken.uid,
            displayName: decodedToken.name || 'Usuario',
            email: decodedToken.email || '',
            photoURL: decodedToken.picture || null,
        };

        const batch = adminFirestore.batch();
        let tenantId: string;
        let tenantRef;
        
        // 2. Check if tenant exists
        const tenantsRef = adminFirestore.collection("tenants");
        const q = tenantsRef.where("ownerUid", "==", user.uid);
        const querySnapshot = await q.get();

        if (querySnapshot.empty) {
            // 3a. If no tenant, create all initial documents
            tenantRef = adminFirestore.collection("tenants").doc();
            tenantId = tenantRef.id;

            // Create User
            const userRef = adminFirestore.collection("users").doc(user.uid);
            batch.set(userRef, {
                uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL,
                tenantIds: [tenantId], isSuperadmin: false,
            });

            // Create Tenant
            batch.set(tenantRef, {
                id: tenantId, type: planId.toUpperCase(), name: `Espacio de ${user.displayName.split(' ')[0]}`,
                baseCurrency: "ARS", createdAt: new Date().toISOString(), ownerUid: user.uid,
                status: "pending", // Will be activated by license
                settings: JSON.stringify({ quietHours: true, rollover: false }),
            });

            // Create Membership
            const membershipRef = adminFirestore.collection("memberships").doc(`${tenantId}_${user.uid}`);
            batch.set(membershipRef, {
                tenantId: tenantId, uid: user.uid, displayName: user.displayName, email: user.email,
                role: 'owner', status: 'active', joinedAt: new Date().toISOString()
            });

            // Create default categories and subcategories
            defaultCategories.forEach((category, catIndex) => {
                const categoryId = crypto.randomUUID();
                const categoryRef = adminFirestore.collection("categories").doc(categoryId);
                batch.set(categoryRef, { id: categoryId, tenantId: tenantId, name: category.name, color: category.color, order: catIndex });

                category.subcategories.forEach((subcategoryName, subCatIndex) => {
                    const subcategoryId = crypto.randomUUID();
                    const subcategoryRef = adminFirestore.collection("subcategories").doc(subcategoryId);
                    batch.set(subcategoryRef, { id: subcategoryId, tenantId: tenantId, categoryId: categoryId, name: subcategoryName, order: subCatIndex });
                });
            });

        } else {
            // 3b. If tenant exists, just get its ID
            const tenantDoc = querySnapshot.docs[0];
            tenantId = tenantDoc.id;
            tenantRef = tenantDoc.ref;
            if (tenantDoc.data().status === 'active') {
                return { success: false, error: 'Ya tienes un plan activo.' };
            }
        }
        
        // 4. Create License and activate Tenant
        const licenseRef = adminFirestore.collection("licenses").doc();
        const startDate = new Date();
        const endDate = new Date();
        if (planId === 'demo') {
            endDate.setDate(startDate.getDate() + 15);
        } else {
            endDate.setFullYear(startDate.getFullYear() + 1);
        }

        const maxUsersMapping: { [key: string]: number } = {
            personal: 1, familiar: 4, empresa: 10, demo: 1,
        };

        batch.set(licenseRef, {
            id: licenseRef.id, tenantId: tenantId, plan: planId, status: 'active',
            startDate: startDate.toISOString(), endDate: endDate.toISOString(),
            maxUsers: maxUsersMapping[planId as keyof typeof maxUsersMapping],
            paymentId: `sim_${crypto.randomUUID()}`,
        });

        // 5. Activate tenant
        batch.update(tenantRef, { status: "active" });

        // 6. Commit all changes
        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error("Error in subscribeToPlanAction:", error);
         if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
            return { success: false, error: "Tu sesión ha expirado o es inválida. Por favor, inicia sesión de nuevo." };
        }
        return { success: false, error: error.message || 'Ocurrió un error inesperado al suscribirse al plan.' };
    }
}
