import { db } from '@/lib/db'

export type CreateDocumentInput = {
  companyId: string
  fileName: string
  fileType: string
  fileSize?: number
  storageKey: string
  documentType?: 'INVOICE' | 'BILL' | 'RECEIPT' | 'CONTRACT' | 'OTHER'
  uploadedBy?: string
  entityType?: 'CLIENT' | 'REVENUE' | 'BILL' | 'CUSTOMER_PAYMENT' | 'VENDOR_PAYMENT' | 'EXPENSE' | 'EMPLOYEE' | 'VENDOR'
  entityId?: string
}

export class DocumentService {
  static async createDocument(input: CreateDocumentInput) {
    const { companyId, fileName, fileType, fileSize, storageKey, documentType, uploadedBy, entityType, entityId } = input

    return db.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          companyId,
          fileName,
          fileType,
          fileSize: fileSize || null,
          storageKey,
          documentType: documentType || 'GENERAL',
          uploadedBy: uploadedBy || null,
        },
      })

      if (entityType && entityId) {
        await tx.documentLink.create({
          data: {
            documentId: doc.id,
            entityType,
            entityId,
          },
        })
      }

      return doc
    })
  }

  static async getDocumentsForEntity(companyId: string, entityType: string, entityId: string) {
    const links = await db.documentLink.findMany({
      where: {
        entityType,
        entityId,
        document: { companyId },
      },
      include: {
        document: true,
      },
    })

    return links.map((l) => l.document)
  }

  static async linkDocumentToEntity(documentId: string, entityType: string, entityId: string) {
    return db.documentLink.create({
      data: {
        documentId,
        entityType,
        entityId,
      },
    })
  }
}
