import type { Contact, CreateRequestInput, MoneyRequest, RequestEvent, RequestStatus, EventType } from './types'

// Default to live backend at 127.0.0.1:8000. Can be overridden via VITE_API_BASE_URL.
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'
const ENV_API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export const getApiBaseUrl = (): string => {
  if (ENV_API_BASE_URL && ENV_API_BASE_URL.trim() !== '') {
    return ENV_API_BASE_URL.replace(/\/$/, '')
  }
  if (import.meta.env.PROD) {
    console.warn('[SecondSignal] VITE_API_BASE_URL is not set in production. Falling back to default:', DEFAULT_API_BASE_URL)
  }
  return DEFAULT_API_BASE_URL
}

export const isDemoMode = (): boolean => {
  const mode = localStorage.getItem('secondsignal_mode')
  if (mode === 'demo') return true
  if (mode === 'live') return false
  return getApiBaseUrl() === ''
}

export const setDemoMode = (demo: boolean): void => {
  localStorage.setItem('secondsignal_mode', demo ? 'demo' : 'live')
}

// Active demo persona management
export interface DemoActor {
  id: string
  name: string
  role: 'Requester' | 'Trusted Contact' | 'Observer'
  label: string
  description: string
}

export const DEMO_ACTORS: DemoActor[] = [
  { id: 'alice', name: 'Alice', role: 'Requester', label: 'Requester Persona', description: 'Creates emergency verification requests.' },
  { id: 'bob', name: 'Bob', role: 'Trusted Contact', label: 'Assigned Approver', description: 'Reviews and approves/denies requests.' },
  { id: 'carol', name: 'Carol', role: 'Observer', label: 'Unrelated Persona', description: 'Simulates unauthorized access attempts.' },
]

export const getActiveActorId = (): string => {
  return localStorage.getItem('secondsignal_actor') || 'alice'
}

export const setActiveActorId = (actorId: string): void => {
  localStorage.setItem('secondsignal_actor', actorId)
}

export const getActiveActor = (): DemoActor => {
  const currentId = getActiveActorId()
  return DEMO_ACTORS.find(a => a.id === currentId) || DEMO_ACTORS[0]
}

// Fallback in-memory contacts if demo mode is enabled
export const contacts: Contact[] = [
  { id: 'bob', name: 'Demo Trusted Contact Bob', relationship: 'Assigned Contact', label: 'Contact', enrolledAt: '2026-01-01', status: 'Enrolled' },
  { id: 'alice', name: 'Demo Requester Alice', relationship: 'Requester', label: 'Self', enrolledAt: '2026-01-01', status: 'Enrolled' },
  { id: 'carol', name: 'Demo Unrelated User Carol', relationship: 'Unrelated Observer', label: 'Observer', enrolledAt: '2026-01-01', status: 'Enrolled' },
]

// Fallback in-memory mock requests for isolated demo mode
const now = new Date()
const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60000).toISOString()

let demoRequests: MoneyRequest[] = [
  {
    id: 'SS-DEMO-001', amount: 25000, payee: 'Apollo Pharmacy', purpose: 'Emergency prescription refill',
    requester: 'alice', trustedContactId: 'bob', status: 'PENDING',
    createdAt: iso(45), expiresAt: new Date(now.getTime() + 6 * 3600000).toISOString(), updatedAt: iso(45), version: 1,
    events: [{ id: 'e-1', type: 'created', description: 'Request created and sent for review', timestamp: iso(45), actor: 'alice' }],
  },
  {
    id: 'SS-DEMO-002', amount: 8200, payee: 'City Municipal Water', purpose: 'Urgent utility deposit',
    requester: 'alice', trustedContactId: 'bob', status: 'APPROVED',
    createdAt: iso(160), expiresAt: new Date(now.getTime() + 2 * 3600000).toISOString(), updatedAt: iso(138), version: 1,
    events: [
      { id: 'e-2', type: 'approved', description: 'Details reviewed and approved by trusted contact', timestamp: iso(138), actor: 'bob' },
      { id: 'e-3', type: 'created', description: 'Request created and sent for review', timestamp: iso(160), actor: 'alice' },
    ],
  },
]

// Mapping backend events to frontend timeline events
const mapBackendEventType = (rawType: string): EventType => {
  switch (rawType) {
    case 'request_created': return 'created'
    case 'request_approved': return 'approved'
    case 'request_denied': return 'denied'
    case 'request_changed': return 'edited'
    case 'approval_invalidated': return 'invalidated'
    case 'request_expired': return 'expired'
    default: return 'edited'
  }
}

const mapBackendEventDescription = (rawType: string, meta: Record<string, unknown> = {}): string => {
  switch (rawType) {
    case 'request_created': return 'Request created and sent for review'
    case 'request_approved': return 'Details reviewed and approved by trusted contact'
    case 'request_denied': return 'Request denied by trusted contact'
    case 'request_changed': {
      const fields = Array.isArray(meta.changed_fields) ? meta.changed_fields.join(', ') : 'details'
      return `Request details changed (${fields}). Fresh review required.`
    }
    case 'approval_invalidated': return 'Protected details changed. Previous approval is no longer valid.'
    case 'request_expired': return 'Request expired without approval'
    default: return rawType
  }
}

interface BackendRequestOut {
  id: string
  requester_id: string
  approver_id: string
  amount_minor: number
  currency: string
  payee: string
  purpose: string
  status: string
  version: number
  expires_at: string
  created_at: string
  updated_at: string
  decision_by: string | null
  decided_at: string | null
  decision_note: string | null
}

interface BackendEventOut {
  id: string
  request_id: string
  event_type: string
  actor_id: string | null
  request_version: number
  timestamp_utc: string
  metadata: Record<string, unknown>
}

interface BackendDemoUser {
  id: string
  display_name: string
}

const transformBackendRequest = (bReq: BackendRequestOut, events: RequestEvent[] = []): MoneyRequest => ({
  id: bReq.id,
  amount: bReq.amount_minor / 100,
  payee: bReq.payee,
  purpose: bReq.purpose,
  requester: bReq.requester_id,
  trustedContactId: bReq.approver_id,
  status: bReq.status as RequestStatus,
  createdAt: bReq.created_at,
  expiresAt: bReq.expires_at,
  updatedAt: bReq.updated_at,
  version: bReq.version,
  decisionBy: bReq.decision_by,
  decisionNote: bReq.decision_note,
  decidedAt: bReq.decided_at,
  events,
})

const transformBackendEvent = (e: BackendEventOut): RequestEvent => ({
  id: e.id,
  type: mapBackendEventType(e.event_type),
  description: mapBackendEventDescription(e.event_type, e.metadata),
  timestamp: e.timestamp_utc,
  actor: e.actor_id || 'System',
})

// Centralized fetch client with header injection, error mapping, and timeout
const requestApi = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const baseUrl = getApiBaseUrl()
  const actor = getActiveActorId()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Demo-User': actor,
    ...(options.headers as Record<string, string> || {}),
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, { ...options, headers })
  } catch (err) {
    throw new Error(`Network failure connecting to backend (${baseUrl}): ${(err as Error).message}. Verify the server is running.`)
  }

  if (!response.ok) {
    let errorDetail = ''
    try {
      const errJson = await response.json()
      errorDetail = errJson.detail || JSON.stringify(errJson)
    } catch {
      errorDetail = response.statusText
    }

    if (response.status === 401) {
      throw new Error(`[401 Unauthorized] ${errorDetail || 'Missing or invalid demo user identity. Please choose Alice, Bob, or Carol.'}`)
    } else if (response.status === 403) {
      throw new Error(`[403 Forbidden] ${errorDetail || 'You are not authorized for this action as the current demo persona.'}`)
    } else if (response.status === 404) {
      throw new Error(`[404 Not Found] ${errorDetail || 'The requested resource was not found on the server.'}`)
    } else if (response.status === 409) {
      throw new Error(`[409 Conflict] ${errorDetail || 'This request has changed or was already decided. Refresh to review latest details.'}`)
    } else if (response.status === 410) {
      throw new Error(`[410 Expired] ${errorDetail || 'This request has expired and can no longer be decided.'}`)
    } else if (response.status === 422) {
      throw new Error(`[422 Validation Error] ${errorDetail}`)
    } else {
      throw new Error(`API Error (${response.status}): ${errorDetail}`)
    }
  }

  return response.json() as Promise<T>
}

export const api = {
  listDemoUsers: async (): Promise<Contact[]> => {
    if (isDemoMode()) return contacts
    try {
      const users = await requestApi<BackendDemoUser[]>('/api/demo-users')
      return users.map(u => ({
        id: u.id,
        name: u.display_name,
        relationship: u.id === 'bob' ? 'Trusted Contact' : u.id === 'alice' ? 'Requester' : 'Observer',
        label: u.id === 'bob' ? 'Approver' : 'Demo User',
        enrolledAt: '2026-01-01',
        status: 'Enrolled' as const,
      }))
    } catch (err) {
      console.warn('Failed to fetch /api/demo-users, falling back to local list:', err)
      return contacts
    }
  },

  listRequests: async (): Promise<MoneyRequest[]> => {
    if (isDemoMode()) {
      return [...demoRequests]
    }
    const backendRequests = await requestApi<BackendRequestOut[]>('/api/requests')
    // Fetch events in parallel for each request
    const enriched = await Promise.all(
      backendRequests.map(async (r) => {
        try {
          const events = await api.getRequestEvents(r.id)
          return transformBackendRequest(r, events)
        } catch {
          return transformBackendRequest(r, [])
        }
      })
    )
    return enriched
  },

  getRequest: async (id: string): Promise<MoneyRequest> => {
    if (isDemoMode()) {
      const match = demoRequests.find(r => r.id === id)
      if (!match) throw new Error('Request not found in demo storage.')
      return match
    }
    const [bReq, events] = await Promise.all([
      requestApi<BackendRequestOut>(`/api/requests/${id}`),
      api.getRequestEvents(id),
    ])
    return transformBackendRequest(bReq, events)
  },

  getRequestEvents: async (id: string): Promise<RequestEvent[]> => {
    if (isDemoMode()) {
      const match = demoRequests.find(r => r.id === id)
      return match ? match.events : []
    }
    const bEvents = await requestApi<BackendEventOut[]>(`/api/requests/${id}/events`)
    return bEvents.map(transformBackendEvent)
  },

  createRequest: async (input: CreateRequestInput): Promise<MoneyRequest> => {
    if (isDemoMode()) {
      const newReq: MoneyRequest = {
        ...input,
        id: `SS-DEMO-${String(100 + demoRequests.length)}`,
        requester: getActiveActorId(),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        events: [{
          id: crypto.randomUUID(),
          type: 'created',
          description: 'Request created and sent for review',
          timestamp: new Date().toISOString(),
          actor: getActiveActorId(),
        }],
      }
      demoRequests = [newReq, ...demoRequests]
      return newReq
    }

    // Convert INR rupees to integer paise
    const amountMinor = Math.round(input.amount * 100)

    // Ensure ISO string with timezone
    let expiry = input.expiresAt
    if (!expiry.includes('T')) {
      expiry = new Date(expiry).toISOString()
    } else if (!expiry.endsWith('Z') && !expiry.includes('+')) {
      expiry = new Date(expiry).toISOString()
    }

    const payload = {
      approver_id: input.trustedContactId,
      amount_minor: amountMinor,
      currency: 'INR',
      payee: input.payee.trim(),
      purpose: input.purpose.trim(),
      expires_at: expiry,
    }

    const created = await requestApi<BackendRequestOut>('/api/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const events = await api.getRequestEvents(created.id)
    return transformBackendRequest(created, events)
  },

  decide: async (id: string, decision: 'approve' | 'deny', expectedVersion: number, decisionNote?: string): Promise<MoneyRequest> => {
    if (isDemoMode()) {
      const match = demoRequests.find(r => r.id === id)
      if (!match) throw new Error('Request not found in demo storage.')
      if (match.version !== expectedVersion) throw new Error('Request changed on server. Refresh.')
      match.status = decision === 'approve' ? 'APPROVED' : 'DENIED'
      match.updatedAt = new Date().toISOString()
      match.events.unshift({
        id: crypto.randomUUID(),
        type: decision === 'approve' ? 'approved' : 'denied',
        description: decision === 'approve' ? 'Approved by trusted contact' : 'Denied by trusted contact',
        timestamp: match.updatedAt,
        actor: getActiveActorId(),
      })
      return match
    }

    const payload = {
      expected_version: expectedVersion,
      decision_note: decisionNote || (decision === 'approve' ? 'Confirmed through separate trusted channel' : 'Denied by trusted contact'),
    }

    const updated = await requestApi<BackendRequestOut>(`/api/requests/${id}/${decision}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const events = await api.getRequestEvents(updated.id)
    return transformBackendRequest(updated, events)
  },

  updateRequest: async (
    id: string,
    input: { amount?: number; payee?: string; purpose?: string; trustedContactId?: string; expiresAt?: string }
  ): Promise<MoneyRequest> => {
    if (isDemoMode()) {
      const match = demoRequests.find(r => r.id === id)
      if (!match) throw new Error('Request not found in demo storage.')
      if (input.amount) match.amount = input.amount
      if (input.payee) match.payee = input.payee
      if (input.purpose) match.purpose = input.purpose
      if (input.trustedContactId) match.trustedContactId = input.trustedContactId
      if (input.expiresAt) match.expiresAt = input.expiresAt
      match.version += 1
      match.status = 'PENDING'
      match.updatedAt = new Date().toISOString()
      match.events.unshift({
        id: crypto.randomUUID(),
        type: 'invalidated',
        description: 'Request details changed. Previous approval invalidated.',
        timestamp: match.updatedAt,
        actor: getActiveActorId(),
      })
      return match
    }

    const patchPayload: Record<string, unknown> = {}
    if (input.amount !== undefined) patchPayload.amount_minor = Math.round(input.amount * 100)
    if (input.payee !== undefined) patchPayload.payee = input.payee.trim()
    if (input.purpose !== undefined) patchPayload.purpose = input.purpose.trim()
    if (input.trustedContactId !== undefined) patchPayload.approver_id = input.trustedContactId
    if (input.expiresAt !== undefined) {
      let expiry = input.expiresAt
      if (!expiry.includes('T')) expiry = new Date(expiry).toISOString()
      else if (!expiry.endsWith('Z') && !expiry.includes('+')) expiry = new Date(expiry).toISOString()
      patchPayload.expires_at = expiry
    }

    const patched = await requestApi<BackendRequestOut>(`/api/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patchPayload),
    })

    const events = await api.getRequestEvents(patched.id)
    return transformBackendRequest(patched, events)
  },
}

export const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)

export const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  } catch {
    return value
  }
}

export const formatDateTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  } catch {
    return value
  }
}
