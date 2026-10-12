import { useSyncExternalStore } from 'react'

export interface Region {
  id: string
  name: string
  code: string
  active: boolean
}

export interface Company {
  id: string
  name: string
  code: string
  tagline: string
  active: boolean
  regions: Region[]
}

export interface Workspace {
  company: string
  region: string
}

const REGION_SET = (activeIds: string[] = []): Region[] => [
  { id: 'india', name: 'India', code: 'IN', active: activeIds.includes('india') },
  { id: 'malaysia', name: 'Malaysia', code: 'MY', active: activeIds.includes('malaysia') },
  { id: 'singapore', name: 'Singapore', code: 'SG', active: activeIds.includes('singapore') },
]

export const COMPANIES: Company[] = [
  {
    id: 'techserv',
    name: 'TechServ.ai',
    code: 'TS',
    tagline: 'Services, delivery & deal-to-billing operations',
    active: true,
    regions: REGION_SET(['india']),
  },
  {
    id: 'techpay',
    name: 'TechPay.ai',
    code: 'TP',
    tagline: 'Payments, treasury & financial platforms',
    active: true,
    regions: REGION_SET(['india']),
  },
]

const STORAGE_KEY = 'techserv-workspace'
const listeners = new Set<() => void>()

export function findCompany(id: string | undefined): Company | undefined {
  return COMPANIES.find((c) => c.id === id)
}

function isValid(ws: Workspace | null): ws is Workspace {
  if (!ws) return false
  const company = findCompany(ws.company)
  const region = company?.regions.find((r) => r.id === ws.region)
  return Boolean(company?.active && region?.active)
}

let cachedRaw: string | null | undefined
let cachedValue: Workspace | null = null

export function getWorkspace(): Workspace | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cachedValue
  cachedRaw = raw
  try {
    const parsed = raw ? (JSON.parse(raw) as Workspace) : null
    cachedValue = isValid(parsed) ? parsed : null
  } catch {
    cachedValue = null
  }
  return cachedValue
}

function emit() {
  listeners.forEach((fn) => fn())
}

export function setWorkspace(ws: Workspace): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ws))
  emit()
}

export function clearWorkspace(): void {
  localStorage.removeItem(STORAGE_KEY)
  emit()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) fn()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('storage', onStorage)
  }
}

export function useWorkspace(): Workspace | null {
  return useSyncExternalStore(subscribe, getWorkspace, getWorkspace)
}

export function isTechPay(ws: Workspace | null): boolean {
  return ws?.company === 'techpay'
}

export function workspaceLabel(ws: Workspace | null): string | null {
  if (!ws) return null
  const company = findCompany(ws.company)
  const region = company?.regions.find((r) => r.id === ws.region)
  if (!company || !region) return null
  return `${company.name.replace(/\.ai$/, '')} · ${region.name}`
}
