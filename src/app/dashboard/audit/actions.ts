
'use server';

import { initializeFirebase } from '@/firebase/config';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

type AuditLogPayload = {
    tenantId: string;
    entity: string; // 'expenses', 'budgets', 'memberships', etc.
    entityId: string;
    action: 'create' | 'update' | 'delete' | 'soft-delete' | 'invite';
    userId: string;
    before: object | null;
    after: object | null;
};

/**
 * Logs an audit event to the Firestore 'audit_logs' collection.
 * This is a server action to ensure logs are created securely.
 * @param payload - The details of the event to log.
 * @returns Promise resolving to an object with success status or an error.
 */
export async function logAuditEvent(payload: AuditLogPayload): Promise<{ success: boolean; error?: string }> {
    try {
        const firebaseApp = initializeFirebase();
        const firestore = getFirestore(firebaseApp);
        
        const logRef = doc(firestore, 'audit_logs', crypto.randomUUID());

        const logData = {
            id: logRef.id,
            ...payload,
            before: JSON.stringify(payload.before), // Store as JSON string
            after: JSON.stringify(payload.after),   // Store as JSON string
            ts: new Date().toISOString(),
        };

        await setDoc(logRef, logData);

        return { success: true };

    } catch (error: any) {
        console.error('Error in logAuditEvent:', error);
        // We don't want to block the main user action if logging fails,
        // but we should report the failure.
        return { success: false, error: 'Failed to write audit log. ' + error.message };
    }
}
