import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hashPassword } from '@/lib/auth'

function verifyPassword(input: string, hash: string): boolean {
  if (!hash.startsWith('demo$')) return false
  const stored = hash.slice(5)
  const computed = Buffer.from(input).reverse().toString('utf8')
  return stored === computed
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const company = await db.company.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { users: true, clients: true, employees: true } },
    },
  })
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const tenantAdmin = company.users.find((u) => u.role === 'COMPANY_ADMIN') || company.users[0] || null

  return NextResponse.json({ company, tenantAdmin })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'GROUP_ADMIN') {
    return NextResponse.json({ error: 'Only Group Admin can edit tenant companies' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { name, code, status, adminEmail, adminPassword } = body

  const company = await db.company.findUnique({
    where: { id },
    include: { users: true },
  })
  if (!company) return NextResponse.json({ error: 'Tenant company not found' }, { status: 404 })

  if (company.type === 'PARENT') {
    return NextResponse.json({ error: 'Parent Group headquarters cannot be altered' }, { status: 400 })
  }

  // Update Company meta
  const updatedCompany = await db.company.update({
    where: { id },
    data: {
      ...(name ? { name: name.trim() } : {}),
      ...(code ? { code: code.trim().toUpperCase() } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      children: true,
      _count: { select: { users: true, clients: true, employees: true } },
    },
  })

  // Update or Create Tenant Admin user credentials if provided
  let adminUser = company.users.find((u) => u.role === 'COMPANY_ADMIN') || company.users[0]
  if (adminEmail || adminPassword) {
    if (adminUser) {
      if (adminEmail && adminEmail.toLowerCase().trim() !== adminUser.email) {
        const existing = await db.user.findUnique({ where: { email: adminEmail.toLowerCase().trim() } })
        if (existing && existing.id !== adminUser.id) {
          return NextResponse.json({ error: `Email "${adminEmail}" is already used by another user` }, { status: 400 })
        }
      }

      await db.user.update({
        where: { id: adminUser.id },
        data: {
          ...(adminEmail ? { email: adminEmail.toLowerCase().trim() } : {}),
          ...(adminPassword ? { passwordHash: hashPassword(adminPassword.trim()) } : {}),
        },
      })
    } else if (adminEmail) {
      const password = adminPassword?.trim() || 'TenantAdmin123!'
      await db.user.create({
        data: {
          email: adminEmail.toLowerCase().trim(),
          name: `${name || company.name} Admin`,
          passwordHash: hashPassword(password),
          role: 'COMPANY_ADMIN',
          companyId: company.id,
          active: true,
        },
      })
    }
  }

  return NextResponse.json({ company: updatedCompany }, { status: 200 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'GROUP_ADMIN') {
    return NextResponse.json({ error: 'Only Group Admin can delete tenant companies' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { password } = body

  if (!password) {
    return NextResponse.json({ error: 'Tenant admin password confirmation is required for deletion' }, { status: 400 })
  }

  const company = await db.company.findUnique({
    where: { id },
    include: { users: true },
  })
  if (!company) return NextResponse.json({ error: 'Tenant company not found' }, { status: 404 })

  if (company.type === 'PARENT') {
    return NextResponse.json({ error: 'Parent Group headquarters cannot be deleted' }, { status: 400 })
  }

  // Find tenant admin user for password verification
  const tenantAdmin = company.users.find((u) => u.role === 'COMPANY_ADMIN') || company.users[0]
  
  let isPasswordValid = false
  if (tenantAdmin) {
    isPasswordValid = verifyPassword(password.trim(), tenantAdmin.passwordHash)
  }
  
  // Fallback: verify against group admin password if tenant admin has no user or password mismatch
  if (!isPasswordValid) {
    const groupAdminUser = await db.user.findUnique({ where: { id: user.id } })
    if (groupAdminUser) {
      isPasswordValid = verifyPassword(password.trim(), groupAdminUser.passwordHash)
    }
  }

  if (!isPasswordValid) {
    return NextResponse.json({ error: 'Invalid Tenant Admin password. Deletion verification failed!' }, { status: 400 })
  }

  // Password confirmed! Delete company (cascades related records in schema)
  await db.company.delete({
    where: { id },
  })

  return NextResponse.json({ success: true, message: `Tenant "${company.name}" deleted successfully` }, { status: 200 })
}
