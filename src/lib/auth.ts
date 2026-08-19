/**
 * Server-side auth helpers for Drona Enterprises.
 * Demo-grade cookie-session auth (NOT for production).
 */
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'
import argon2 from 'argon2'

const SESSION_COOKIE = 'drona_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 12 // 12h

export type SessionUser = {
  id: string
  name: string
  email: string
  role: 'GROUP_ADMIN' | 'COMPANY_ADMIN' | 'STANDARD_USER'
  companyId: string | null
  company?: { id: string; name: string; code: string; type: string } | null
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
  })
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password)
  } catch {
    return false
  }
}

export async function login(email: string, password: string): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { company: true },
  })
  if (!user || !user.active) return null
  if (!(await verifyPassword(password, user.passwordHash))) {
    return null
  }

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.session.create({ data: { userId: user.id, token, expiresAt } })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })

  return toSessionUser(user)
}

export async function logout(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {})
  }
  ;(await cookies()).delete(SESSION_COOKIE)
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({
    where: { token },
    include: { user: { include: { company: true } } },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  if (!session.user.active) return null
  return toSessionUser(session.user)
}

function toSessionUser(u: {
  id: string; name: string; email: string; role: string; companyId: string | null;
  company?: { id: string; name: string; code: string; type: string } | null
}): SessionUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as SessionUser['role'],
    companyId: u.companyId,
    company: u.company
      ? { id: u.company.id, name: u.company.name, code: u.company.code, type: u.company.type }
      : null,
  }
}

/**
 * Returns the list of company IDs the user is allowed to access.
 * - GROUP_ADMIN: all companies (parent + all tenants)
 * - COMPANY_ADMIN / STANDARD_USER: only their own company
 */
export async function getAccessibleCompanyIds(user: SessionUser): Promise<string[]> {
  if (user.role === 'GROUP_ADMIN') {
    const all = await db.company.findMany({ select: { id: true } })
    return all.map((c) => c.id)
  }
  return user.companyId ? [user.companyId] : []
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
