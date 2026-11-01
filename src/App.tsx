import { createContext, FormEvent, useContext, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  api,
  DEMO_ACTORS,
  DemoActor,
  formatDate,
  formatDateTime,
  formatINR,
  getActiveActor,
  getActiveActorId,
  isDemoMode,
  setActiveActorId,
  setDemoMode,
} from './api'
import type { Contact, CreateRequestInput, MoneyRequest, RequestStatus } from './types'

// Navigation items
const navItems = [
  ['/', '⌂', 'Dashboard'],
  ['/requests', '▤', 'All requests'],
  ['/create', '+', 'Create request'],
  ['/contacts', '♧', 'Trusted contacts'],
  ['/activity', '◷', 'Activity history'],
  ['/account', '◎', 'Account'],
]

// Actor Context for reactive persona switching
interface ActorContextType {
  actor: DemoActor
  setActor: (actorId: string) => void
  refreshKey: number
  refreshData: () => void
}

const ActorContext = createContext<ActorContextType>({
  actor: DEMO_ACTORS[0],
  setActor: () => {},
  refreshKey: 0,
  refreshData: () => {},
})

export function useDemoActor() {
  return useContext(ActorContext)
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [actor, setActorState] = useState<DemoActor>(getActiveActor())
  const [refreshKey, setRefreshKey] = useState(0)
  const location = useLocation()

  const setActor = (actorId: string) => {
    setActiveActorId(actorId)
    setActorState(getActiveActor())
    setRefreshKey((k) => k + 1)
  }

  const refreshData = () => {
    setRefreshKey((k) => k + 1)
  }

  const currentLabel = location.pathname.endsWith('/review')
    ? 'Trusted contact review'
    : location.pathname.startsWith('/requests/')
    ? 'Request details'
    : location.pathname === '/'
    ? 'Overview'
    : navItems.find(([path]) => path === location.pathname)?.[2] || 'Request'

  return (
    <ActorContext.Provider value={{ actor, setActor, refreshKey, refreshData }}>
      <div className="app-shell">
        <Sidebar open={sidebarOpen} close={() => setSidebarOpen(false)} />
        <main className="main-content">
          <header className="topbar">
            <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
              ☰
            </button>
            <div className="breadcrumb">
              SecondSignal <span>/</span> <strong>{currentLabel}</strong>
            </div>

            <div className="top-actions">
              <span className="secure-dot">●</span>
              <span className="demo-badge" title="Prototype demo identity: X-Demo-User header emulation. NOT real authentication.">
                DEMO IDENTITY
              </span>

              <div className="actor-switcher-wrap">
                <select
                  className="actor-select"
                  value={actor.id}
                  onChange={(e) => setActor(e.target.value)}
                  aria-label="Demo actor switcher"
                >
                  <option value="alice">Alice (Requester)</option>
                  <option value="bob">Bob (Trusted Contact)</option>
                  <option value="carol">Carol (Observer)</option>
                </select>
              </div>

              <div className="avatar" title={`${actor.name} (${actor.role})`}>
                {actor.name.slice(0, 2).toUpperCase()}
              </div>
            </div>
          </header>

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/create" element={<CreateRequest />} />
            <Route path="/requests/:id" element={<RequestDetails />} />
            <Route path="/requests/:id/review" element={<ReviewRequest />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </main>
      </div>
    </ActorContext.Provider>
  )
}

function Sidebar({ open, close }: { open: boolean; close: () => void }) {
  const location = useLocation()
  const { actor } = useDemoActor()

  return (
    <>
      {open && <div className="sidebar-backdrop visible" onClick={close} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <b>
              Second<span>Signal</span>
            </b>
            <small>Verify before money moves</small>
          </div>
        </div>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav>
          {navItems.map(([path, icon, label]) => (
            <NavLink
              key={path}
              to={path}
              onClick={close}
              className={() =>
                location.pathname === path || (path !== '/' && location.pathname.startsWith(path)) ? 'active' : ''
              }
            >
              <i>{icon}</i>
              {label}
              {label === 'Create request' && <span className="nav-plus">↗</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trust-card">
            <span className="shield">✓</span>
            <div>
              <b>Protected workflow</b>
              <p>Approvals are separate from payment.</p>
            </div>
          </div>
          <div className="profile">
            <div className="avatar">{actor.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <b>{actor.name}</b>
              <small>{actor.label}</small>
            </div>
            <span>•••</span>
          </div>
        </div>
      </aside>
    </>
  )
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger' }) {
  return (
    <button className={`button ${variant}`} {...props}>
      {children}
    </button>
  )
}

function StatusBadge({ status }: { status: RequestStatus }) {
  const labels: Record<RequestStatus, string> = {
    PENDING: 'Pending review',
    APPROVED: 'Approved',
    DENIED: 'Denied',
    EXPIRED: 'Expired',
    INVALIDATED: 'Approval invalidated',
  }
  return (
    <span className={`status ${status.toLowerCase()}`}>
      <i />
      {labels[status] || status}
    </span>
  )
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">⌁</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

function ErrorState({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="error-state">
      <b>We couldn't load this view</b>
      <p>{error}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="loading-state">
      <span />
      <span />
      <span /> Loading securely…
    </div>
  )
}

function useRequests() {
  const { refreshKey, actor } = useDemoActor()
  const [requests, setRequests] = useState<MoneyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    api
      .listRequests()
      .then(setRequests)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [refreshKey, actor.id])
  return { requests, loading, error, reload: load }
}

function Dashboard() {
  const { actor } = useDemoActor()
  const { requests, loading, error, reload } = useRequests()

  const stats = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((r) => r.status === 'PENDING' || r.status === 'INVALIDATED').length,
      approved: requests.filter((r) => r.status === 'APPROVED').length,
      closed: requests.filter((r) => r.status === 'DENIED' || r.status === 'EXPIRED').length,
    }),
    [requests]
  )

  const demoActive = isDemoMode()
  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

  return (
    <div className="page">
      <PageHeader
        eyebrow={todayFormatted}
        title={`Good day, ${actor.name}`}
        description={`Active persona: ${actor.role}. A clear second signal before an urgent payment moves.`}
        action={
          <Link className="button primary" to="/create">
            <span>＋</span> Create request
          </Link>
        }
      />

      {demoActive && (
        <div className="demo-banner">
          <span>ISOLATED DEMO STORAGE</span> Running in in-memory demo mode. Connect to live backend via Account settings.
        </div>
      )}

      {error ? (
        <ErrorState error={error} retry={reload} />
      ) : loading ? (
        <LoadingState />
      ) : (
        <>
          <div className="stats-grid">
            {[
              ['total', 'Total requests', 'Visible to active persona'],
              ['pending', 'Awaiting review', 'Need a second signal'],
              ['approved', 'Approved', 'Server-confirmed'],
              ['closed', 'Denied or expired', 'Closed requests'],
            ].map(([key, label, sub]) => (
              <div className="stat-card" key={key}>
                <div className="stat-top">
                  <span>{label}</span>
                  <span className={`stat-icon ${key}`}>
                    {key === 'total' ? '⌁' : key === 'pending' ? '◷' : key === 'approved' ? '✓' : '×'}
                  </span>
                </div>
                <strong>{stats[key as keyof typeof stats]}</strong>
                <small>{sub}</small>
              </div>
            ))}
          </div>
          <div className="dashboard-grid">
            <section className="card recent-card">
              <div className="section-heading">
                <div>
                  <h2>Recent requests</h2>
                  <p>Payments requiring verification visible to {actor.name}.</p>
                </div>
                <Link to="/requests">
                  View all <span>→</span>
                </Link>
              </div>
              <RequestTable requests={requests.slice(0, 4)} />
            </section>
            <ActivityTimeline requests={requests} />
          </div>
        </>
      )}
    </div>
  )
}

function RequestTable({ requests }: { requests: MoneyRequest[] }) {
  if (!requests.length) {
    return (
      <EmptyState
        title="No requests yet"
        text="Create a request when you need a trusted contact to verify details before funds move."
      />
    )
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Request</th>
            <th>Amount</th>
            <th>Created</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>
                <Link className="request-name" to={`/requests/${r.id}`}>
                  {r.payee}
                </Link>
                <small>
                  {r.id.slice(0, 8)}... · {r.purpose}
                </small>
              </td>
              <td className="amount">{formatINR(r.amount)}</td>
              <td>{formatDate(r.createdAt)}</td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              <td>
                <Link className="row-action" to={`/requests/${r.id}`} aria-label={`View ${r.id}`}>
                  →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActivityTimeline({ requests }: { requests: MoneyRequest[] }) {
  const events = requests
    .flatMap((r) => r.events.map((e) => ({ ...e, requestId: r.id, payee: r.payee })))
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
    .slice(0, 6)

  return (
    <section className="card activity-card">
      <div className="section-heading">
        <div>
          <h2>Recent activity</h2>
          <p>Server-confirmed events</p>
        </div>
        <Link to="/activity">
          View history <span>→</span>
        </Link>
      </div>
      <div className="timeline">
        {events.length ? (
          events.map((event) => (
            <div className="timeline-item" key={event.id}>
              <div className={`timeline-dot ${event.type}`} />
              <div>
                <b>{event.description}</b>
                <p>
                  {event.actor} · {formatDateTime(event.timestamp)}
                </p>
                <Link to={`/requests/${event.requestId}`}>
                  {event.requestId.slice(0, 8)}... · {event.payee}
                </Link>
              </div>
            </div>
          ))
        ) : (
          <p style={{ color: '#888', fontSize: '11px' }}>No activity logged yet.</p>
        )}
      </div>
    </section>
  )
}

function Requests() {
  const { requests, loading, error, reload } = useRequests()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')

  const filtered = requests.filter(
    (r) =>
      `${r.id} ${r.payee} ${r.purpose}`.toLowerCase().includes(query.toLowerCase()) &&
      (status === 'ALL' || r.status === status)
  )

  return (
    <div className="page">
      <PageHeader
        eyebrow="Request centre"
        title="All requests"
        description="Every request, decision, and audit event in one place."
        action={
          <Link className="button primary" to="/create">
            ＋ Create request
          </Link>
        }
      />
      <section className="card">
        <div className="filters">
          <label className="search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by payee, ID or purpose"
            />
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
            <option value="EXPIRED">Expired</option>
            <option value="INVALIDATED">Invalidated</option>
          </select>
          <Button variant="quiet" onClick={reload}>
            ↻ Refresh
          </Button>
        </div>
        {error ? (
          <ErrorState error={error} retry={reload} />
        ) : loading ? (
          <LoadingState />
        ) : filtered.length ? (
          <RequestTable requests={filtered} />
        ) : (
          <EmptyState title="No matching requests" text="Try changing your search or status filter." />
        )}
      </section>
    </div>
  )
}

function CreateRequest() {
  const navigate = useNavigate()
  const { actor } = useDemoActor()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([])

  const [form, setForm] = useState<CreateRequestInput>({
    amount: 25000,
    payee: '',
    purpose: '',
    trustedContactId: 'bob',
    expiresAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    api.listDemoUsers().then((users) => {
      // Filter out self so requester cannot assign themselves
      const valid = users.filter((u) => u.id !== actor.id)
      setAvailableContacts(valid)
      if (valid.length && !valid.some((u) => u.id === form.trustedContactId)) {
        setForm((f) => ({ ...f, trustedContactId: valid[0].id }))
      }
    })
  }, [actor.id])

  const update = (key: keyof CreateRequestInput, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }))

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.amount || form.amount < 100) next.amount = 'Enter an amount of at least ₹100.'
    if (form.amount > 1000000) next.amount = 'For your security, requests are limited to ₹10,00,000.'
    if (!form.payee.trim()) next.payee = 'Enter the payee name.'
    if (!form.purpose.trim()) next.purpose = 'Add a short, clear purpose.'
    if (!form.trustedContactId) next.trustedContactId = 'Select a trusted contact.'
    if (form.trustedContactId === actor.id) next.trustedContactId = 'Requester and approver must be different.'
    if (new Date(form.expiresAt) <= new Date()) next.expiresAt = 'Choose a future expiry time.'
    setErrors(next)
    return !Object.keys(next).length
  }

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      const r = await api.createRequest(form)
      navigate(`/requests/${r.id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const selectedContact = availableContacts.find((c) => c.id === form.trustedContactId)

  return (
    <div className="page narrow-page">
      <PageHeader
        eyebrow="New request"
        title="Create a payment request"
        description="Ask an assigned trusted contact to verify details before funds move."
      />
      <div className="stepper">
        <div className={step >= 1 ? 'current' : ''}>
          <span>1</span> Details
        </div>
        <i />
        <div className={step >= 2 ? 'current' : ''}>
          <span>2</span> Review & send
        </div>
      </div>
      {error && <div className="inline-error">{error}</div>}
      {step === 1 ? (
        <form
          className="card form-card"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (validate()) setStep(2)
          }}
        >
          <Field label="Amount" hint="INR (stored as integer paise on server)" error={errors.amount}>
            <div className="money-input">
              <span>₹</span>
              <input
                type="number"
                min="100"
                step="100"
                value={form.amount || ''}
                onChange={(e) => update('amount', Number(e.target.value))}
                aria-label="Amount in Indian rupees"
              />
            </div>
          </Field>
          <Field label="Payee name" error={errors.payee}>
            <input
              value={form.payee}
              onChange={(e) => update('payee', e.target.value)}
              placeholder="e.g. Apollo Pharmacy"
            />
          </Field>
          <Field label="Payment purpose" error={errors.purpose}>
            <textarea
              value={form.purpose}
              onChange={(e) => update('purpose', e.target.value)}
              placeholder="Why does this payment need to be made?"
              rows={3}
            />
          </Field>
          <Field label="Trusted contact" hint="Only enrolled contacts can approve" error={errors.trustedContactId}>
            <select
              value={form.trustedContactId}
              onChange={(e) => update('trustedContactId', e.target.value)}
            >
              {availableContacts.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name} · {c.relationship}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Expiry date & time" hint="Must be in future (max 72h)" error={errors.expiresAt}>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => update('expiresAt', e.target.value)}
            />
          </Field>
          <div className="form-actions">
            <Link className="button quiet" to="/">
              Cancel
            </Link>
            <Button type="submit">
              Review request <span>→</span>
            </Button>
          </div>
        </form>
      ) : (
        <section className="card review-card">
          <div className="review-intro">
            <span className="review-icon">✓</span>
            <div>
              <h2>Check every detail</h2>
              <p>Your trusted contact will verify the exact payee, amount, and purpose.</p>
            </div>
          </div>
          <div className="review-list">
            <ReviewRow label="Amount" value={formatINR(form.amount)} prominent />
            <ReviewRow label="Payee" value={form.payee} />
            <ReviewRow label="Purpose" value={form.purpose} />
            <ReviewRow label="Requester persona" value={`${actor.name} (${actor.id})`} />
            <ReviewRow label="Trusted contact" value={selectedContact?.name || form.trustedContactId} />
            <ReviewRow label="Expires" value={formatDateTime(form.expiresAt)} />
          </div>
          <div className="notice">
            <b>Remember</b>
            <span>Verify urgent requests through a separate trusted channel before anyone acts on them.</span>
          </div>
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setStep(1)}>
              ← Back to edit
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? 'Sending securely to server…' : 'Submit request'}
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
      {error && <em>{error}</em>}
    </label>
  )
}

function ReviewRow({ label, value, prominent }: { label: string; value: string; prominent?: boolean }) {
  return (
    <div className="review-row">
      <span>{label}</span>
      <b className={prominent ? 'prominent' : ''}>{value}</b>
    </div>
  )
}

function useRequest(id?: string) {
  const { refreshKey, actor } = useDemoActor()
  const [request, setRequest] = useState<MoneyRequest | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    if (!id) return
    setLoading(true)
    setError('')
    api
      .getRequest(id)
      .then(setRequest)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id, refreshKey, actor.id])
  return { request, loading, error, reload: load, setRequest }
}

function RequestDetails() {
  const { id } = useParams()
  const { actor } = useDemoActor()
  const { request, loading, error, reload, setRequest } = useRequest(id)
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [editForm, setEditForm] = useState<{
    amount: number
    payee: string
    purpose: string
    expiresAt: string
  }>({
    amount: 0,
    payee: '',
    purpose: '',
    expiresAt: '',
  })

  useEffect(() => {
    if (request) {
      setEditForm({
        amount: request.amount,
        payee: request.payee,
        purpose: request.purpose,
        expiresAt: request.expiresAt ? request.expiresAt.slice(0, 16) : '',
      })
    }
  }, [request])

  if (loading) {
    return (
      <div className="page">
        <LoadingState />
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="page">
        <ErrorState error={error || 'Request not found.'} retry={reload} />
      </div>
    )
  }

  const isRequester = request.requester === actor.id
  const isApprover = request.trustedContactId === actor.id
  const isEditable = isRequester && (request.status === 'PENDING' || request.status === 'APPROVED')
  const wasApprovalInvalidated = request.version > 1 && request.status === 'PENDING'

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setEditSaving(true)
    setEditError('')
    try {
      const patchData: { amount?: number; payee?: string; purpose?: string; expiresAt?: string } = {}
      if (editForm.amount && editForm.amount !== request.amount) patchData.amount = editForm.amount
      if (editForm.payee.trim() && editForm.payee.trim() !== request.payee) patchData.payee = editForm.payee.trim()
      if (editForm.purpose.trim() && editForm.purpose.trim() !== request.purpose) patchData.purpose = editForm.purpose.trim()
      const origExpiryShort = request.expiresAt ? request.expiresAt.slice(0, 16) : ''
      if (editForm.expiresAt && editForm.expiresAt !== origExpiryShort) {
        patchData.expiresAt = new Date(editForm.expiresAt).toISOString()
      }
      if (Object.keys(patchData).length === 0) {
        setEditOpen(false)
        return
      }
      const updated = await api.updateRequest(request.id, patchData)
      setRequest(updated)
      setEditOpen(false)
    } catch (err) {
      setEditError((err as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="page">
      <Link className="back-link" to="/requests">
        ← All requests
      </Link>
      <PageHeader
        eyebrow={`Request ID: ${request.id}`}
        title={request.payee}
        description={request.purpose}
        action={
          <div className="header-actions">
            <Button variant="quiet" onClick={reload}>
              ↻ Refresh
            </Button>
            {isEditable && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                Edit request
              </Button>
            )}
            {isApprover && request.status === 'PENDING' && (
              <Button variant="primary" onClick={() => navigate(`/requests/${request.id}/review`)}>
                Review as contact
              </Button>
            )}
          </div>
        }
      />

      <div className="detail-grid">
        <section className="card detail-main">
          <div className="detail-amount">
            <span>Requested amount</span>
            <strong>{formatINR(request.amount)}</strong>
            <StatusBadge status={request.status} />
          </div>

          {wasApprovalInvalidated && (
            <div className="warning-box">
              <b>Protected details changed</b>
              <p>
                The server automatically invalidated the previous approval because protected details were modified.
                This request is now v{request.version} and returns to PENDING until the trusted contact reviews again.
              </p>
            </div>
          )}

          {request.status === 'APPROVED' && request.decisionNote && (
            <div className="notice" style={{ marginTop: '14px', marginBottom: '14px' }}>
              <b>Approval note:</b>
              <span>
                "{request.decisionNote}" — decided by {request.decisionBy}
              </span>
            </div>
          )}

          {request.status === 'DENIED' && request.decisionNote && (
            <div className="inline-error" style={{ marginTop: '14px', marginBottom: '14px' }}>
              <b>Denial reason:</b>
              <span>
                "{request.decisionNote}" — decided by {request.decisionBy}
              </span>
            </div>
          )}

          <div className="detail-fields">
            <ReviewRow label="Requester" value={`${request.requester} ${isRequester ? '(You)' : ''}`} />
            <ReviewRow label="Trusted contact" value={`${request.trustedContactId} ${isApprover ? '(You)' : ''}`} />
            <ReviewRow label="Created" value={formatDateTime(request.createdAt)} />
            <ReviewRow label="Expires" value={formatDateTime(request.expiresAt)} />
            <ReviewRow label="Last updated" value={formatDateTime(request.updatedAt)} />
            <ReviewRow label="Request version" value={`v${request.version}`} />
          </div>

          {request.status === 'PENDING' && (
            <div className="decision-strip">
              <div>
                <b>Assigned reviewer</b>
                <p>
                  {isApprover
                    ? 'You are assigned to review and decide on this request.'
                    : `${request.trustedContactId} has been asked to check these details.`}
                </p>
              </div>
              {isApprover ? (
                <Link className="button primary" to={`/requests/${request.id}/review`}>
                  Open review
                </Link>
              ) : (
                <span style={{ fontSize: '11px', color: '#688' }}>Awaiting contact action</span>
              )}
            </div>
          )}
        </section>

        <section className="card detail-side">
          <div className="section-heading">
            <div>
              <h2>Request timeline</h2>
              <p>Confirmed by server audit events</p>
            </div>
          </div>
          <div className="timeline">
            {request.events.map((event) => (
              <div className="timeline-item" key={event.id}>
                <div className={`timeline-dot ${event.type}`} />
                <div>
                  <b>{event.description}</b>
                  <p>
                    {event.actor} · {formatDateTime(event.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Edit Request Modal */}
      {editOpen && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '480px' }}>
            <div className="modal-icon approve">✎</div>
            <h2>Edit request details</h2>
            <p style={{ fontSize: '11px', color: '#666', marginBottom: '16px' }}>
              Editing protected details (amount, payee, purpose, or expiry) will increment the request version to v
              {request.version + 1} and automatically invalidate any previous approval on the server.
            </p>

            {editError && <div className="inline-error">{editError}</div>}

            <form onSubmit={handleEditSubmit}>
              <Field label="Amount" hint="INR">
                <div className="money-input">
                  <span>₹</span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={editForm.amount || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                    required
                  />
                </div>
              </Field>

              <Field label="Payee name">
                <input
                  value={editForm.payee}
                  onChange={(e) => setEditForm((f) => ({ ...f, payee: e.target.value }))}
                  required
                />
              </Field>

              <Field label="Payment purpose">
                <textarea
                  value={editForm.purpose}
                  onChange={(e) => setEditForm((f) => ({ ...f, purpose: e.target.value }))}
                  rows={3}
                  required
                />
              </Field>

              <Field label="Expiry date & time">
                <input
                  type="datetime-local"
                  value={editForm.expiresAt}
                  onChange={(e) => setEditForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </Field>

              <div className="form-actions">
                <Button variant="quiet" type="button" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editSaving}>
                  {editSaving ? 'Submitting PATCH…' : 'Save changes & re-verify'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewRequest() {
  const { id } = useParams()
  const { actor } = useDemoActor()
  const { request, loading, error, reload, setRequest } = useRequest(id)
  const [confirm, setConfirm] = useState<'approve' | 'deny' | null>(null)
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState('')
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="page">
        <LoadingState />
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="page">
        <ErrorState error={error || 'Request not found.'} retry={reload} />
      </div>
    )
  }

  const isAssignedContact = request.trustedContactId === actor.id
  const isPending = request.status === 'PENDING'
  const disabled = !isPending

  const decide = async () => {
    if (!confirm) return
    setActing(true)
    setActionError('')
    try {
      const updated = await api.decide(request.id, confirm, request.version, note.trim() || undefined)
      setRequest(updated)
      setConfirm(null)
      navigate(`/requests/${request.id}`)
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="page narrow-page">
      <Link className="back-link" to={`/requests/${request.id}`}>
        ← Request details
      </Link>
      <PageHeader
        eyebrow="Trusted contact review"
        title="Review before deciding"
        description="Verify the exact payment parameters through a separate trusted channel."
      />

      <div className="card review-panel">
        <div className="review-hero">
          <div>
            <span>REQUEST AMOUNT</span>
            <strong>{formatINR(request.amount)}</strong>
          </div>
          <StatusBadge status={request.status} />
        </div>

        {!isAssignedContact && (
          <div className="inline-error" style={{ marginBottom: '18px' }}>
            <b>Unauthorized Persona Warning</b>
            <p>
              You are currently viewing as <strong>{actor.name} ({actor.role})</strong>. Only the assigned contact (
              <strong>{request.trustedContactId}</strong>) is permitted by the backend to approve or deny this request.
            </p>
          </div>
        )}

        <div className="warning-box">
          <div className="warning-mark">!</div>
          <div>
            <b>Verify the request through a separate trusted channel before making a decision.</b>
            <p>
              Call or message the requester using a telephone number you already trust. Do not rely solely on the
              message or notification that brought you here.
            </p>
          </div>
        </div>

        <div className="review-section-label">Details to verify</div>
        <div className="review-list">
          <ReviewRow label="Payee" value={request.payee} />
          <ReviewRow label="Purpose" value={request.purpose} />
          <ReviewRow label="Requester persona" value={request.requester} />
          <ReviewRow label="Expires" value={formatDateTime(request.expiresAt)} />
          <ReviewRow label="Request version" value={`v${request.version}`} />
        </div>

        <div className="review-check">
          <span>✓</span>
          <div>
            <b>Approve only the exact details shown above</b>
            <p>If any detail differs, deny this request and ask the requester to create a fresh one.</p>
          </div>
        </div>

        {disabled ? (
          <div className="disabled-review">
            <StatusBadge status={request.status} />
            <p>This request is no longer open for a decision (Status: {request.status}).</p>
          </div>
        ) : (
          <div className="decision-buttons">
            <Button variant="secondary" disabled={acting || !isAssignedContact} onClick={() => setConfirm('deny')}>
              Deny request
            </Button>
            <Button disabled={acting || !isAssignedContact} onClick={() => setConfirm('approve')}>
              Approve details <span>→</span>
            </Button>
          </div>
        )}
      </div>

      {confirm && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true">
            <div className={`modal-icon ${confirm}`}>{confirm === 'approve' ? '✓' : '×'}</div>
            <h2>{confirm === 'approve' ? 'Approve these details?' : 'Deny this request?'}</h2>
            <p>
              {confirm === 'approve'
                ? 'Only approve if you have independently confirmed the payee and amount directly with the requester.'
                : 'The requester will see that this request was denied by the trusted contact.'}
            </p>

            {actionError && <div className="inline-error">{actionError}</div>}

            <Field label="Decision note (optional)" hint="Recorded in audit trail">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={confirm === 'approve' ? 'e.g. Confirmed phone call at 2:30 PM' : 'e.g. Payee unverified'}
              />
            </Field>

            <div className="form-actions">
              <Button variant="quiet" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant={confirm === 'approve' ? 'primary' : 'danger'}
                onClick={decide}
                disabled={acting}
              >
                {acting ? 'Submitting to server…' : `Confirm ${confirm}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Contacts() {
  const [contactsList, setContactsList] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .listDemoUsers()
      .then(setContactsList)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Your safety circle"
        title="Trusted contacts"
        description="Only enrolled contacts can review and decide on your payment requests."
      />
      {loading ? (
        <LoadingState />
      ) : (
        <div className="contacts-grid">
          {contactsList.map((c) => (
            <section className="card contact-card" key={c.id}>
              <div className="contact-avatar">{c.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <h2>{c.name}</h2>
                <p>
                  {c.relationship} · {c.label}
                </p>
                <span className="enrolled">● {c.status}</span>
              </div>
              <span className="contact-more">•••</span>
              <div className="contact-date">Enrolled {formatDate(c.enrolledAt)}</div>
            </section>
          ))}
        </div>
      )}
      <div className="notice">
        <b>Keep your circle intentional</b>
        <span>Contacts are managed securely through verified account settings.</span>
      </div>
    </div>
  )
}

function Activity() {
  const { requests, loading, error, reload } = useRequests()

  const events = requests
    .flatMap((r) => r.events.map((e) => ({ ...e, requestId: r.id, payee: r.payee })))
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))

  return (
    <div className="page">
      <PageHeader
        eyebrow="Audit trail"
        title="Activity history"
        description="A chronological record of server-confirmed verification request events."
        action={
          <Button variant="quiet" onClick={reload}>
            ↻ Refresh
          </Button>
        }
      />
      {error ? (
        <ErrorState error={error} retry={reload} />
      ) : loading ? (
        <LoadingState />
      ) : (
        <section className="card activity-full">
          <div className="timeline">
            {events.length ? (
              events.map((event) => (
                <div className="timeline-item" key={event.id}>
                  <div className={`timeline-dot ${event.type}`} />
                  <div>
                    <b>{event.description}</b>
                    <p>
                      {event.actor} · {formatDateTime(event.timestamp)}
                    </p>
                    <Link to={`/requests/${event.requestId}`}>
                      {event.requestId.slice(0, 8)}... · {event.payee} →
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: '#888', fontSize: '12px' }}>No events recorded on server.</p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function Account() {
  const { actor } = useDemoActor()
  const demoActive = isDemoMode()
  const [, setRerender] = useState(0)

  const toggleConnectionMode = () => {
    setDemoMode(!demoActive)
    setRerender((r) => r + 1)
  }

  return (
    <div className="page narrow-page">
      <PageHeader
        eyebrow="Workspace"
        title="Account & settings"
        description="Your prototype demo identity and backend connection settings."
      />
      <section className="card account-card">
        <div className="account-identity">
          <div className="avatar large">{actor.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <h2>{actor.name}</h2>
            <p>
              {actor.role} · {actor.label}
            </p>
          </div>
        </div>

        <div className="demo-warning">
          <b>Prototype Demonstration Mode</b>
          <p>
            The selected identity supplies the <code>X-Demo-User: {actor.id}</code> header. This is a prototype
            demonstration harness and does NOT provide cryptographic identity or payment rail authorization.
          </p>
        </div>

        <div className="setting-row">
          <div>
            <b>Backend Connection</b>
            <p>
              {demoActive
                ? 'Using isolated client-side mock storage'
                : 'Connected to live FastAPI backend at http://127.0.0.1:8000'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`connection ${demoActive ? 'demo' : ''}`}>● {demoActive ? 'Demo' : 'Live API'}</span>
            <Button variant="quiet" onClick={toggleConnectionMode}>
              Switch to {demoActive ? 'Live API' : 'Demo Mode'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default App
