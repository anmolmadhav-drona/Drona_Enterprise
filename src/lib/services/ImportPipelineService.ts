import { db } from '@/lib/db'

export type ColumnMapping = Record<string, string>

export class ImportPipelineService {
  /**
   * Creates an ImportJob and stages raw uploaded row content.
   */
  static async createJob(params: {
    companyId: string
    uploadedBy: string
    sourceType: 'EXCEL' | 'CSV' | 'TALLY'
    fileName: string
    fileType: string
    rawRows: Record<string, any>[]
  }) {
    const { companyId, uploadedBy, sourceType, fileName, fileType, rawRows } = params

    return db.$transaction(async (tx) => {
      const job = await tx.importJob.create({
        data: {
          companyId,
          uploadedBy,
          sourceType,
          fileName,
          fileType,
          status: 'UPLOADED',
          totalRows: rawRows.length,
        },
      })

      // Insert Staging Rows
      const rowPromises = rawRows.map((raw, idx) => {
        return tx.importRow.create({
          data: {
            importJobId: job.id,
            rowNumber: idx + 1,
            rawContent: JSON.stringify(raw),
            status: 'PENDING',
          },
        })
      })

      await Promise.all(rowPromises)

      return job
    })
  }

  /**
   * Applies column mapping and runs row validation & duplicate checking.
   */
  static async validateAndMapJob(params: {
    jobId: string
    companyId: string
    targetEntity: 'REVENUE' | 'EXPENSE' | 'BILL' | 'CLIENT' | 'VENDOR'
    mapping: ColumnMapping
  }) {
    const { jobId, companyId, targetEntity, mapping } = params

    return db.$transaction(async (tx) => {
      const job = await tx.importJob.findUnique({
        where: { id: jobId },
        include: { rows: true },
      })

      if (!job || job.companyId !== companyId) {
        throw new Error('Import job not found or unauthorized')
      }

      await tx.importJob.update({
        where: { id: jobId },
        data: {
          status: 'VALIDATING',
          columnMapping: JSON.stringify(mapping),
        },
      })

      let validCount = 0
      let invalidCount = 0
      let duplicateCount = 0
      let totalDebitSum = 0
      let totalCreditSum = 0

      // Existing production identifiers to check duplicates against
      const existingInvoices = new Set((await tx.revenue.findMany({ select: { invoiceNo: true } })).map((r) => r.invoiceNo))
      const existingBills = new Set((await tx.bill.findMany({ select: { billNumber: true } })).map((b) => b.billNumber))
      const clients = await tx.client.findMany({ where: { companyId }, select: { id: true, name: true, code: true } })

      for (const row of job.rows) {
        // Clear previous errors
        await tx.importError.deleteMany({ where: { importRowId: row.id } })

        const raw = JSON.parse(row.rawContent)
        const mappedData: Record<string, any> = {}
        const errors: Array<{ columnName?: string; errorCode: string; errorMessage: string }> = []

        // Map column values
        Object.entries(mapping).forEach(([dronaField, sourceCol]) => {
          if (sourceCol && raw[sourceCol] !== undefined) {
            mappedData[dronaField] = raw[sourceCol]
          }
        })

        // Target Specific Validations
        if (targetEntity === 'REVENUE') {
          const invNo = mappedData['invoiceNo'] || raw['Voucher Number'] || raw['Invoice No'] || raw['Voucher No']
          const clientName = mappedData['clientName'] || raw['Party Name'] || raw['Client']
          const dateVal = mappedData['date'] || raw['Voucher Date'] || raw['Date']
          const amountVal = mappedData['amount'] || raw['Debit'] || raw['Amount']

          if (!invNo) errors.push({ columnName: 'invoiceNo', errorCode: 'REQUIRED_FIELD', errorMessage: 'Invoice Number is missing' })
          if (!clientName) errors.push({ columnName: 'clientName', errorCode: 'REQUIRED_FIELD', errorMessage: 'Client/Party Name is missing' })
          if (!dateVal) errors.push({ columnName: 'date', errorCode: 'REQUIRED_FIELD', errorMessage: 'Invoice Date is missing' })
          if (amountVal == null || isNaN(Number(amountVal))) {
            errors.push({ columnName: 'amount', errorCode: 'INVALID_NUMERIC', errorMessage: 'Valid Invoice Amount is required' })
          } else {
            totalDebitSum += Number(amountVal)
          }

          // Duplicate check
          if (invNo && existingInvoices.has(String(invNo).trim())) {
            errors.push({ columnName: 'invoiceNo', errorCode: 'DUPLICATE_RECORD', errorMessage: `Invoice #${invNo} already exists in production` })
          }

          mappedData['invoiceNo'] = invNo
          mappedData['clientName'] = clientName
          mappedData['date'] = dateVal
          mappedData['amount'] = Number(amountVal) || 0
        }

        let rowStatus = 'VALID'
        if (errors.length > 0) {
          const isDuplicateOnly = errors.every((e) => e.errorCode === 'DUPLICATE_RECORD')
          if (isDuplicateOnly) {
            rowStatus = 'DUPLICATE'
            duplicateCount++
          } else {
            rowStatus = 'INVALID'
            invalidCount++
          }

          // Save error logs
          for (const err of errors) {
            await tx.importError.create({
              data: {
                importRowId: row.id,
                columnName: err.columnName || null,
                errorCode: err.errorCode,
                errorMessage: err.errorMessage,
              },
            })
          }
        } else {
          validCount++
        }

        await tx.importRow.update({
          where: { id: row.id },
          data: {
            normalizedData: JSON.stringify(mappedData),
            targetEntity,
            status: rowStatus,
            errorMessage: errors.length > 0 ? errors[0].errorMessage : null,
          },
        })
      }

      const updatedJob = await tx.importJob.update({
        where: { id: jobId },
        data: {
          status: 'READY_FOR_REVIEW',
          validRows: validCount,
          invalidRows: invalidCount,
          duplicateRows: duplicateCount,
          totalDebit: totalDebitSum,
          totalCredit: totalCreditSum,
        },
        include: {
          rows: { include: { errors: true } },
        },
      })

      return updatedJob
    })
  }

  /**
   * Production import of verified valid rows inside database transactions.
   */
  static async executeProductionImport(jobId: string, companyId: string, userId?: string) {
    return db.$transaction(async (tx) => {
      const job = await tx.importJob.findUnique({
        where: { id: jobId },
        include: { rows: { where: { status: 'VALID' } } },
      })

      if (!job || job.companyId !== companyId) {
        throw new Error('Import job not found or unauthorized')
      }

      await tx.importJob.update({
        where: { id: jobId },
        data: { status: 'IMPORTING', startedAt: new Date() },
      })

      let successCount = 0
      let failedCount = 0

      // Match or Create default Client for import rows
      const defaultClient = await tx.client.findFirst({
        where: { companyId },
      })

      for (const row of job.rows) {
        try {
          if (!row.normalizedData) continue
          const data = JSON.parse(row.normalizedData)

          if (row.targetEntity === 'REVENUE') {
            let client = await tx.client.findFirst({
              where: { companyId, name: data.clientName },
            })

            // Auto-provision client if name doesn't exist yet
            if (!client) {
              const defaultType = await tx.clientType.findFirst()
              const defaultLoc = await tx.location.findFirst()
              client = await tx.client.create({
                data: {
                  companyId,
                  name: data.clientName || 'Imported Client',
                  code: `IMP-${Date.now().toString(36).toUpperCase()}`,
                  clientTypeId: defaultType?.id || 'default-type',
                  locationId: defaultLoc?.id || 'default-loc',
                  source: 'EXCEL_IMPORT',
                },
              })
            }

            const revenue = await tx.revenue.create({
              data: {
                clientId: client.id,
                date: new Date(data.date || Date.now()),
                invoiceNo: String(data.invoiceNo),
                description: `Imported via ${job.fileName}`,
                quantity: 1,
                rate: Number(data.amount),
                amount: Number(data.amount),
                source: job.sourceType === 'EXCEL' ? 'EXCEL_IMPORT' : 'CSV_IMPORT',
                externalId: `ROW-${row.rowNumber}`,
                status: 'UNPAID',
              },
            })

            await tx.importRow.update({
              where: { id: row.id },
              data: { status: 'IMPORTED', targetId: revenue.id },
            })
            successCount++
          }
        } catch (e: any) {
          failedCount++
          await tx.importRow.update({
            where: { id: row.id },
            data: { status: 'FAILED', errorMessage: e.message },
          })
        }
      }

      const reconciliation = {
        totalSourceDebit: job.totalDebit ?? 0,
        totalImportedDebit: job.totalDebit ?? 0,
        difference: 0,
        status: failedCount === 0 ? 'RECONCILED' : 'REQUIRES_REVIEW',
      }

      const completedJob = await tx.importJob.update({
        where: { id: jobId },
        data: {
          status: failedCount === 0 ? 'COMPLETED' : 'PARTIAL',
          successfulRows: successCount,
          failedRows: failedCount,
          reconciliation: JSON.stringify(reconciliation),
          completedAt: new Date(),
        },
      })

      // Audit Log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: userId || null,
          action: 'IMPORT',
          entityType: 'IMPORT_JOB',
          entityId: jobId,
          details: JSON.stringify({ fileName: job.fileName, importedRows: successCount, failedRows: failedCount }),
        },
      })

      return { job: completedJob, reconciliation }
    })
  }

    /**
   * Imports Logistics / Dispatch MIS rows into the PostgreSQL
   * import staging layer.
   *
   * This intentionally does not create Revenue/Bill records because
   * Logistics MIS is not yet represented by a dedicated production
   * Prisma model.
   */
  static async executeLogisticsImport(params: {
    companyId: string
    uploadedBy: string
    fileName: string
    fileType: string
    rawRows: Record<string, any>[]
    mapping: Record<string, string>
  }) {
    const {
      companyId,
      uploadedBy,
      fileName,
      fileType,
      rawRows,
      mapping,
    } = params

    return db.$transaction(async (tx) => {
      const job = await tx.importJob.create({
        data: {
          companyId,
          uploadedBy,
          sourceType: 'EXCEL',
          fileName,
          fileType,
          status: 'IMPORTING',
          totalRows: rawRows.length,
          startedAt: new Date(),
          columnMapping: JSON.stringify(mapping),
        },
      })

      let successfulRows = 0
      let failedRows = 0

      for (let index = 0; index < rawRows.length; index++) {
        const raw = rawRows[index]

        try {
          const normalizedData: Record<string, any> = {}

          Object.entries(mapping).forEach(
            ([targetField, sourceColumn]) => {
              normalizedData[targetField] =
                raw[sourceColumn] ?? ''
            }
          )

          // Keep the original MIS fields as well.
          normalizedData.sourceRow = raw

          const row = await tx.importRow.create({
            data: {
              importJobId: job.id,
              rowNumber: index + 1,
              rawContent: JSON.stringify(raw),
              normalizedData: JSON.stringify(normalizedData),
              targetEntity: 'LOGISTICS',
              status: 'IMPORTED',
            },
          })

          successfulRows++

          console.log(
            `[LOGISTICS IMPORT] Row ${row.rowNumber} imported`
          )
        } catch (error: any) {
          failedRows++

          await tx.importRow.create({
            data: {
              importJobId: job.id,
              rowNumber: index + 1,
              rawContent: JSON.stringify(raw),
              targetEntity: 'LOGISTICS',
              status: 'FAILED',
              errorMessage:
                error?.message || 'Failed to import row',
            },
          })
        }
      }

      const reconciliation = {
        totalSourceRows: rawRows.length,
        totalImportedRows: successfulRows,
        failedRows,
        difference: rawRows.length - successfulRows,
        status:
          failedRows === 0
            ? 'RECONCILED'
            : 'REQUIRES_REVIEW',
      }

      const completedJob = await tx.importJob.update({
        where: {
          id: job.id,
        },
        data: {
          status:
            failedRows === 0
              ? 'COMPLETED'
              : 'PARTIAL',

          successfulRows,
          failedRows,

          validRows: successfulRows,
          invalidRows: failedRows,

          reconciliation:
            JSON.stringify(reconciliation),

          completedAt: new Date(),
        },
        include: {
          rows: true,
        },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId: null,
          userName: uploadedBy,
          action: 'IMPORT',
          entityType: 'IMPORT',
          entityId: job.id,
          details: JSON.stringify({
            fileName,
            sourceType: 'EXCEL',
            targetEntity: 'LOGISTICS',
            importedRows: successfulRows,
            failedRows,
          }),
        },
      })

      return {
        job: completedJob,
        reconciliation,
      }
    })
  }
}
