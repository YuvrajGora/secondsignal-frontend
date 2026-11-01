export type RequestStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'INVALIDATED'
export type EventType = 'created' | 'approved' | 'denied' | 'edited' | 'invalidated' | 'expired'

export interface Contact {
  id: string
  name: string
  relationship: string
  label: string
  enrolledAt: string
  status: 'Enrolled' | 'Invite pending'
}

export interface RequestEvent {
  id: string
  type: EventType
  description: string
  timestamp: string
  actor: string
}

export interface MoneyRequest {
  id: string
  amount: number
  payee: string
  purpose: string
  requester: string
  trustedContactId: string
  status: RequestStatus
  createdAt: string
  expiresAt: string
  updatedAt: string
  version: number
  events: RequestEvent[]
  decisionBy?: string | null
  decisionNote?: string | null
  decidedAt?: string | null
}

export interface CreateRequestInput {
  amount: number
  payee: string
  purpose: string
  trustedContactId: string
  expiresAt: string
}
