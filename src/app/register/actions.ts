
'use server';

import { initializeAdminApp } from '@/firebase/admin-config';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Creates a 15-day DEMO license for a new personal account
 * and activates the corresponding tenant.
 * This is a server action to be executed in a trusted environment.
 * @param tenantId The ID of the tenant to activate.
 * @returns An object indicating success or failure.
 */
export async function createDemoLicenseAction(
    tenantId: string
): Promise<{ success: boolean; error?: string; }> {
    if (!tenantId) {
        return { success: false, error: "Tenant ID is required." };
    }

    try {
        const adminApp = await initializeAdminApp();
        const adminFirestore = getFirestore(adminApp);
        const batch = adminFirestore.batch();

        // 1. Create the DEMO license document
        const licenseRef = adminFirestore.collection("licenses").doc();
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 15); // 15-day demo

        const licenseData = {
            id: licenseRef.id,
            tenantId: tenantId,
            plan: 'demo',
            status: 'active',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            maxUsers: 1,
        };
        batch.set(licenseRef, licenseData);

        // 2. Update the tenant status to 'active'
        const tenantRef = adminFirestore.collection("tenants").doc(tenantId);
        batch.update(tenantRef, { status: "active" });

        // 3. Commit the batch
        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error("Error creating DEMO license:", error);
        return {
            success: false,
            error: "Failed to create DEMO license. " + error.message,
        };
    }
}
