import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "UPLOAD" | "DOWNLOAD"
type AuditEntity = "Student" | "Supervisor" | "OfficeTeam" | "Contract" | "Document" | "ActivityLog" | "Invoice" | "Payment" | "User" | "System"

interface LogAuditParams {
    action: AuditAction
    entity: AuditEntity
    entityId?: string
    details?: string
    oldValues?: any
    newValues?: any
}

export async function logAudit({ action, entity, entityId, details, oldValues, newValues }: LogAuditParams) {
    try {
        const session = await auth()
        if (!session?.user?.id) return // Don't log system actions without user context right now

        // Remove deep circular references or huge objects if any, usually Prisma objects are fine
        const safeOld = oldValues ? JSON.parse(JSON.stringify(oldValues)) : null
        const safeNew = newValues ? JSON.parse(JSON.stringify(newValues)) : null

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                userEmail: session.user.email || null,
                action,
                entity,
                entityId: entityId || null,
                details: details || null,
                oldValues: safeOld,
                newValues: safeNew,
                ipAddress: null // Can be grabbed from headers if needed later
            }
        })
    } catch (error) {
        console.error("Failed to write audit log:", error)
        // Silently fail so we don't block the main application flow
    }
}
