import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const items = await db.clientType.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Client type name is required' }, { status: 400 })
  }

  const trimmedName = name.trim()
  const existing = await db.clientType.findUnique({
    where: { name: trimmedName },
  })

  if (existing) {
    return NextResponse.json({ item: existing })
  }

  const item = await db.clientType.create({
    data: { name: trimmedName },
  })

  return NextResponse.json({ item }, { status: 201 })
}
