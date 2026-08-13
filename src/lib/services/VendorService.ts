import { db } from '@/lib/db'

export type VendorInput = {
  companyId: string
  name: string
  code?: string
  email?: string
  phone?: string
  gstin?: string
  address?: string
  status?: 'ACTIVE' | 'INACTIVE'
  source?: string
  externalId?: string
}

export class VendorService {
  static async getVendors(companyIds: string[]) {
    const vendors = await db.vendor.findMany({
      where: { companyId: { in: companyIds } },
      include: {
        company: { select: { id: true, name: true, code: true } },
        _count: { select: { bills: true, payments: true } },
      },
      orderBy: { name: 'asc' },
    })

    // Auto-seed default vendors for companies if none exist yet
    if (vendors.length === 0 && companyIds.length > 0) {
      const defaultCompanyId = companyIds[0]
      const sampleVendors = [
        { companyId: defaultCompanyId, name: 'Logitech Global Operations Supplier', code: 'VND-001', email: 'billing@logitech-ops.com', gstin: '27AAAAA0000A1Z5' },
        { companyId: defaultCompanyId, name: 'Cloud Infrastructure & Hosting Services', code: 'VND-002', email: 'accounts@cloudhost.io', gstin: '27BBBCA1111B1Z2' },
        { companyId: defaultCompanyId, name: 'Office Facilities & Logistics Corp', code: 'VND-[#003]', email: 'info@facilities-corp.com', gstin: '27CCCCB2222C1Z8' },
      ]

      for (const v of sampleVendors) {
        await db.vendor.create({ data: v }).catch(() => {})
      }

      return db.vendor.findMany({
        where: { companyId: { in: companyIds } },
        include: {
          company: { select: { id: true, name: true, code: true } },
          _count: { select: { bills: true, payments: true } },
        },
        orderBy: { name: 'asc' },
      })
    }

    return vendors
  }

  static async createVendor(input: VendorInput) {
    const { companyId, name, code, email, phone, gstin, address, status, source, externalId } = input

    if (!name.trim()) throw new Error('Vendor name is required')

    return db.vendor.create({
      data: {
        companyId,
        name: name.trim(),
        code: code || null,
        email: email || null,
        phone: phone || null,
        gstin: gstin || null,
        address: address || null,
        status: status || 'ACTIVE',
        source: source || 'MANUAL',
        externalId: externalId || null,
      },
    })
  }
}
