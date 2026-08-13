import { db } from '@/lib/db'

export type LogAuditInput = {
  companyId?: string
  userId?: string
  userName?: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'REVERSE' | 'IMPORT'
  entityType: 'REVENUE' | 'CUSTOMER_PAYMENT' | 'BILL' | 'VENDOR_PAYMENT' | 'EXPENSE' | 'VENDOR' | 'IMPORT_JOB'
  entityId?: string
  details?: Record<string, any>
}

export class AuditService {
  static async log(input: LogAuditInput) {
    const { companyId, userId, userName, action, entityType, entityId, details } = input

    return db.auditLog.create({
      data: {
        companyId: companyId || null,
        userId: userId || null,
        userName: userName || 'System',
        action,
        entityType,
        entityId: entityId || null,
        details: details ? JSON.stringify(details) : null,
      },
    })
  }

  static async getLogs(companyIds: string[], limit = 100) {
    return db.auditLog.findMany({
      where: {
        OR: [
          { companyId: { in: companyIds } },
          { companyId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}
