
import { prisma } from './db';
import { headers } from 'next/headers';

export type AuditAction =
    | 'LOGIN'
    | 'LOGOUT'
    | 'EXPORT_EXCEL'
    | 'EXPORT_CHECKMOB'
    | 'VIEW_AUDIT_LOG'
    | 'CREATE_USER'
    | 'UPDATE_USER'
    | 'DELETE_USER';

/**
 * Logs a system activity to the audit log.
 * This should be used for sensitive actions and tracking user behavior.
 */
export async function logSystemActivity(
    userId: string,
    action: AuditAction,
    details: any = null,
    resourceType?: string,
    resourceId?: string
) {
    try {
        const headersList = headers();
        const ipAddress = headersList.get('x-forwarded-for') || 'unknown';
        const userAgent = headersList.get('user-agent') || 'unknown';

        await prisma.systemAuditLog.create({
            data: {
                userId,
                action,
                details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
                ipAddress,
                userAgent,
                resourceType,
                resourceId,
                status: 'SUCCESS'
            }
        });
    } catch (error) {
        console.error('FAILED TO LOG AUDIT EVENT:', error);
        // We don't throw here to avoid failing the main action if logging fails
    }
}
