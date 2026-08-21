/**
 * Auth + UI state for the Drona app (client-side, single-page).
 */
import { create } from 'zustand'

export type AppUser = {
  id: string
  name: string
  email: string
  role: 'GROUP_ADMIN' | 'COMPANY_ADMIN' | 'STANDARD_USER'
  companyId: string | null
  company?: { id: string; name: string; code: string; type: string } | null
}

export type ModuleKey =
  | 'dashboard'
  | 'companies'
  | 'clients'
  | 'revenue'
  | 'bills'
  | 'employees'
  | 'allocations'
  | 'expenses'
  | 'reports'
  | 'import'

type State = {
  user: AppUser | null
  loading: boolean
  activeModule: ModuleKey
  // Filter context shared by dashboard / lists
  filterCompanyId: string | null
  filterLocationId: string | null
  filterClientTypeId: string | null
  filterFrom: string
  filterTo: string

  setUser: (u: AppUser | null) => void
  setLoading: (b: boolean) => void
  logout: () => void
  setActiveModule: (m: ModuleKey) => void
  setFilter: (patch: Partial<Pick<State, 'filterCompanyId' | 'filterLocationId' | 'filterClientTypeId' | 'filterFrom' | 'filterTo'>>) => void
}

export const useApp = create<State>((set) => ({
  user: null,
  loading: true,
  activeModule: 'dashboard',
  filterCompanyId: null,
  filterLocationId: null,
  filterClientTypeId: null,
  filterFrom: '2024-04-01',
  filterTo: '2024-09-30',

  setUser: (u) => set({ user: u }),
  setLoading: (b) => set({ loading: b }),
  logout: () => set({ user: null, activeModule: 'dashboard', filterCompanyId: null }),
  setActiveModule: (m) => set({ activeModule: m }),
  setFilter: (patch) => set(patch),
}))

export async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const isFormData = init?.body instanceof FormData

  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }

  return res.json()
}
