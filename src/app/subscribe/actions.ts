
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
    console.log(`[subscribeToPlanAction] Iniciando para userId: ${userId} y planId: ${planId}`);

    if (!userId) {
        console.error('[subscribeToPlanAction] Error: ID de usuario no proporcionado.');
        return { success: false, error: "ID de usuario no proporcionado." };
    }

    try {
        console.log('[subscribeToPlanAction] Inicializando Firebase Admin...');
        const adminApp = await initializeAdminApp();
        const adminAuth = getAuth(adminApp);
        const adminFirestore = getFirestore(adminApp);
        
        console.log(`[subscribeToPlanAction] Obteniendo registro de Auth para userId: ${userId}`);
        const userRecord = await adminAuth.getUser(userId);
        const user = {
            uid: userRecord.uid,
            displayName: userRecord.displayName || 'Usuario',
            email: userRecord.email || '',
            photoURL: userRecord.photoURL || null,
        };
        console.log('[subscribeToPlanAction] Información de usuario obtenida:', user.displayName);

        const userRef = adminFirestore.collection("users").doc(user.uid);
        console.log(`[subscribeToPlanAction] Obteniendo documento de Firestore para userId: ${user.uid}`);
        const userSnap = await userRef.get();
        const existingTenantIds = userSnap.data()?.tenantIds || [];
        console.log('[subscribeToPlanAction] Tenant IDs existentes:', existingTenantIds);

        let tenantId: string;
        
        if (existingTenantIds.length === 0) {
            console.log('[subscribeToPlanAction] No se encontraron tenants. Creando uno nuevo...');
            const tenantRef = adminFirestore.collection("tenants").doc();
            tenantId = tenantRef.id;
            console.log(`[subscribeToPlanAction] Nuevo tenantId generado: ${tenantId}`);

            const initialBatch = adminFirestore.batch();
            
            console.log('[subscribeToPlanAction] Añadiendo actualización de usuario al lote inicial...');
            initialBatch.update(userRef, { tenantIds: FieldValue.arrayUnion(tenantId) });

            const tenantData = {
                id: tenantId, type: planId.toUpperCase(), name: `Espacio de ${user.displayName.split(' ')[0]}`,
                baseCurrency: "ARS", createdAt: new Date().toISOString(), ownerUid: user.uid,
                status: "pending",
                settings: JSON.stringify({ quietHours: true, rollover: false }),
            };
            console.log('[subscribeToPlanAction] Añadiendo creación de tenant al lote inicial. Data:', tenantData);
            initialBatch.set(tenantRef, tenantData);
            
            const membershipData = {
                tenantId: tenantId, uid: user.uid, displayName: user.displayName, email: user.email,
                role: 'owner', status: 'active', joinedAt: new Date().toISOString()
            };
            const membershipRef = adminFirestore.collection("memberships").doc(`${tenantId}_${user.uid}`);
            console.log('[subscribeToPlanAction] Añadiendo creación de membresía al lote inicial. Data:', membershipData);
            initialBatch.set(membershipRef, membershipData);

            console.log('[subscribeToPlanAction] Ejecutando lote inicial (update user, create tenant, create membership)...');
            await initialBatch.commit();
            console.log('[subscribeToPlanAction] Lote inicial completado.');
            
            const categoriesBatch = adminFirestore.batch();
            const categoriesCol = adminFirestore.collection("categories");
            const subcategoriesCol = adminFirestore.collection("subcategories");

            console.log('[subscribeToPlanAction] Añadiendo categorías al lote de categorías...');
            defaultCategories.forEach((category, catIndex) => {
                const categoryRef = categoriesCol.doc();
                categoriesBatch.set(categoryRef, { id: categoryRef.id, tenantId: tenantId, name: category.name, color: category.color, order: catIndex });

                category.subcategories.forEach((subcategoryName, subCatIndex) => {
                    const subcategoryRef = subcategoriesCol.doc();
                    categoriesBatch.set(subcategoryRef, { id: subcategoryRef.id, tenantId: tenantId, categoryId: categoryRef.id, name: subcategoryName, order: subCatIndex });
                });
            });
            console.log('[subscribeToPlanAction] Ejecutando lote de categorías...');
            await categoriesBatch.commit();
            console.log('[subscribeToPlanAction] Lote de categorías completado.');
        } else {
            tenantId = existingTenantIds[0];
            console.log(`[subscribeToPlanAction] Usando tenant existente: ${tenantId}`);
            const tenantSnap = await adminFirestore.collection("tenants").doc(tenantId).get();
            if (tenantSnap.data()?.status === 'active') {
                 console.warn(`[subscribeToPlanAction] El usuario ya tiene un plan activo para el tenant ${tenantId}.`);
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
        
        const licenseData = {
            id: licenseRef.id, tenantId: tenantId, plan: planId, status: 'active',
            startDate: startDate.toISOString(), endDate: endDate.toISOString(),
            maxUsers: maxUsersMapping[planId] ?? 1,
            paymentId: `sim_${adminFirestore.collection("anything").doc().id}`,
        };
        console.log('[subscribeToPlanAction] Añadiendo creación de licencia al lote final. Data:', licenseData);
        finalBatch.set(licenseRef, licenseData);

        const tenantRefToUpdate = adminFirestore.collection("tenants").doc(tenantId);
        console.log('[subscribeToPlanAction] Añadiendo actualización de tenant a "active" al lote final...');
        finalBatch.update(tenantRefToUpdate, { status: "active" });
        
        console.log('[subscribeToPlanAction] Ejecutando lote final (licencia y activación)...');
        await finalBatch.commit();
        console.log('[subscribeToPlanAction] Lote final completado. ¡Proceso exitoso!');

        return { success: true };

    } catch (error: any) {
        console.error("[subscribeToPlanAction] ERROR CATCH:", error);
        return { success: false, error: `Ocurrió un error al crear la licencia. (${error.code || 'INTERNAL'})` };
    }
}
