import { useCallback, useEffect, useRef, useState, FormEvent } from 'react'
import { appConfig } from '../lib/config'
import andImage from '../assets/images/and.jpg'
import './ReceptionApp.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckinGroup {
  groupId: number
  groupName: string
  tableNo: number | null
  adultPax: number
  kidsPax: number
  checkedIn: boolean
}

interface RegistrationForm {
  adultCount: number
  kidsCount: number
  giftCount: number
  souvenirCount: number
  titipanGiftCount: number
}

type View = 'scanning' | 'loading' | 'details' | 'success' | 'error'

const SCANNER_ELEMENT_ID = 'reception-qr-reader'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractGroupId(text: string): number | null {
  const trimmed = text.trim()

  // Try parsing as a URL (e.g. https://…?group=2)
  try {
    const url = new URL(trimmed)
    const group = url.searchParams.get('group')
    if (group) {
      const id = parseInt(group, 10)
      if (!isNaN(id) && id > 0) return id
    }
  } catch {
    // Not a URL – fall through
  }

  // Try as a plain integer
  const num = parseInt(trimmed, 10)
  if (!isNaN(num) && num > 0 && String(num) === trimmed) return num

  return null
}

async function fetchCheckinGroup(groupId: number): Promise<CheckinGroup> {
  const response = await fetch(`${appConfig.apiBaseUrl}/api/reception-group.php?id=${groupId}`)
  if (!response.ok) {
    if (response.status === 404) throw new Error('Guest group not found.')
    throw new Error('Failed to load guest information.')
  }
  return response.json() as Promise<CheckinGroup>
}

async function fetchCheckinGroupByName(name: string): Promise<CheckinGroup> {
  const response = await fetch(
    `${appConfig.apiBaseUrl}/api/reception-group.php?name=${encodeURIComponent(name)}`,
  )
  if (!response.ok) {
    if (response.status === 404) throw new Error('Guest group not found.')
    throw new Error('Failed to load guest information.')
  }
  return response.json() as Promise<CheckinGroup>
}

async function submitCheckin(
  groupId: number,
  form: RegistrationForm,
): Promise<void> {
  const response = await fetch(`${appConfig.apiBaseUrl}/api/reception-checkin.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, ...form }),
  })

  if (!response.ok) throw new Error('Failed to save check-in.')
}

// ─── QR Scanner ───────────────────────────────────────────────────────────────

interface QrScannerProps {
  onGroupId: (groupId: number) => void
  onError: (msg: string) => void
}

function QrScanner({ onGroupId, onError }: QrScannerProps) {
  const hasScannedRef = useRef(false)
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)

  useEffect(() => {
    let cancelled = false
    hasScannedRef.current = false

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelled) return

      // Clear any leftover DOM from a previous mount (React StrictMode remounts twice in dev)
      const el = document.getElementById(SCANNER_ELEMENT_ID)
      if (el) el.innerHTML = ''

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false })
      scannerRef.current = scanner

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText: string) => {
            if (hasScannedRef.current || cancelled) return
            const groupId = extractGroupId(decodedText)
            if (groupId !== null) {
              hasScannedRef.current = true
              scanner.stop().catch(() => {})
              onGroupId(groupId)
            }
          },
          () => {
            // per-frame scan errors – silently ignored
          },
        )
        .catch(() => {
          if (!cancelled) onError('Camera access denied. Please allow camera permissions and reload.')
        })
    })

    return () => {
      cancelled = true
      scannerRef.current?.stop().catch(() => {})
      scannerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div id={SCANNER_ELEMENT_ID} className="qr-reader-element" />
}

// ─── Counter row ──────────────────────────────────────────────────────────────

interface CounterRowProps {
  label: string
  value: number
  max?: number
  onChange: (next: number) => void
}

function CounterRow({ label, value, max, onChange }: CounterRowProps) {
  const atMax = max !== undefined && value >= max
  const atMin = value <= 0

  return (
    <div className="counter-row">
      <span className="counter-label">{label}</span>
      <div className="counter-controls">
        <button
          type="button"
          className="counter-btn"
          aria-label={`Decrease ${label}`}
          disabled={atMin}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </button>
        <span className="counter-value">
          {value}
          {max !== undefined ? `/${max}` : ''}
        </span>
        <button
          type="button"
          className="counter-btn"
          aria-label={`Increase ${label}`}
          disabled={atMax}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  )
}

// ─── Page Header ──────────────────────────────────────────────────────────────

interface PageHeaderProps {
  onHomeClick: () => void
}

function PageHeader({ onHomeClick }: PageHeaderProps) {
  return (
    <header className="reception-header">
      <button
        type="button"
        className="header-icon-btn"
        aria-label="Return to scanner"
        onClick={onHomeClick}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </button>

      <div className="header-title">
        <p className="header-eyebrow">Welcome to the wedding of</p>
        <h1 className="header-names">
          Jodie
          <img src={andImage} alt="and" className="header-and-img" />
          Justine
        </h1>
      </div>

      <button
        type="button"
        className="header-icon-btn"
        aria-label="Search guest"
        disabled
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
    </header>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function ReceptionApp() {
  const [view, setView] = useState<View>('scanning')
  const [group, setGroup] = useState<CheckinGroup | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [form, setForm] = useState<RegistrationForm>({
    adultCount: 0,
    kidsCount: 0,
    giftCount: 0,
    souvenirCount: 0,
    titipanGiftCount: 0,
  })

  const handleGroupId = useCallback(async (groupId: number) => {
    setView('loading')
    try {
      const data = await fetchCheckinGroup(groupId)
      setGroup(data)
      setForm({
        adultCount: data.adultPax,
        kidsCount: data.kidsPax,
        giftCount: 0,
        souvenirCount: 0,
        titipanGiftCount: 0,
      })
      setView('details')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load guest.')
      setView('error')
    }
  }, [])

  const handleScanError = useCallback((msg: string) => {
    setErrorMsg(msg)
    setView('error')
  }, [])

  // Auto-load from URL param: /reception.html?group=2
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const groupParam = params.get('group')
    if (groupParam) {
      const id = parseInt(groupParam, 10)
      if (!isNaN(id) && id > 0) handleGroupId(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleManualSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    if (!fullName) return
    
    setFirstName('')
    setLastName('')
    setView('loading')
    try {
      const data = await fetchCheckinGroupByName(fullName)
      setGroup(data)
      setForm({
        adultCount: data.adultPax,
        kidsCount: data.kidsPax,
        giftCount: 0, 
        souvenirCount: 0, 
        titipanGiftCount: 0 
      })
      setView('details')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load guest.')
      setView('error')
    }
  }

  function setCounter(field: keyof RegistrationForm, value: number) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    if (!group) return
    setIsSubmitting(true)
    try {
      await submitCheckin(group.groupId, form)
      setView('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save check-in.')
      setView('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleHome() {
    setView('scanning')
    setGroup(null)
    setErrorMsg('')
  }

  return (
    <div className="reception-shell">
      <PageHeader onHomeClick={handleHome} />

      <main className="reception-main">
        {/* ── SCANNING ── */}
        {view === 'scanning' && (
          <div className="scan-card-outer">
            <p className="scan-card-label">Scan QR Code</p>
            <div className="scan-card-inner">
              <QrScanner onGroupId={handleGroupId} onError={handleScanError} />
            </div>
            <form className="manual-entry-form" onSubmit={handleManualSubmit}>
              <input
                className="manual-entry-input"
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className="manual-entry-input"
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <button type="submit" className="manual-entry-btn">Find</button>
            </form>
          </div>
        )}

        {/* ── LOADING ── */}
        {view === 'loading' && (
          <div className="status-card">
            <p>Loading guest information…</p>
          </div>
        )}

        {/* ── ERROR ── */}
        {view === 'error' && (
          <div className="status-card">
            <p className="error-text">{errorMsg}</p>
            <button type="button" className="submit-btn" onClick={handleHome}>
              Try Again
            </button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {view === 'success' && group && (
          <div className="status-card">
            <svg className="success-icon" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="60" height="60">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <p className="success-text">Check-in Successful!</p>
              <h2 className="success-name" style={{ textTransform: 'none', margin: '10px 0' }}>{group.groupName}</h2>
              {group.tableNo && (
                <p className="success-table" style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '8px', textTransform: 'none' }}>
                  Table number {group.tableNo}
                </p>
              )}
            </div>
            <div className="status-card-actions">
              <button type="button" className="submit-btn" onClick={handleHome}>
                Next Guest
              </button>
            </div>
          </div>
        )}

        {/* ── DETAILS ── */}
        {view === 'details' && group && (
          <div className="details-layout">
            {/* Left – Invitation Details */}
            <div className="detail-card">
              <p className="detail-card-header">Invitation Details</p>
              <div className="detail-card-body">
                <p className="guest-name-display">{group.groupName}</p>
                <dl className="detail-list">
                  <dt>Table No</dt>
                  <dd>{group.tableNo ?? '—'}</dd>

                  <dt className="counter-divider" />
                  <dd className="counter-divider" />

                  <dt>Adult</dt>
                  <dd>{group.adultPax}</dd>

                  <dt>Kids</dt>
                  <dd>{group.kidsPax}</dd>

                  <dt className="counter-divider" />
                  <dd className="counter-divider" />

                  <dt>Status</dt>
                  <dd className={group.checkedIn ? 'status-in' : 'status-out'}>
                    {group.checkedIn ? 'CHECKED IN' : 'NOT CHECKED IN'}
                  </dd>
                </dl>
              </div>
            </div>

            {/* Right – Registration Details */}
            <div className="detail-card registration-card">
              <p className="detail-card-header">Registration Details</p>
              <div className="detail-card-body-counter">
                <CounterRow
                  label="Adult"
                  value={form.adultCount}
                  max={group.adultPax}
                  onChange={(v) => setCounter('adultCount', v)}
                />
                <CounterRow
                  label="Kids"
                  value={form.kidsCount}
                  max={group.kidsPax}
                  onChange={(v) => setCounter('kidsCount', v)}
                />
                <div className="counter-divider" />
                <CounterRow
                  label="Gift"
                  value={form.giftCount}
                  onChange={(v) => setCounter('giftCount', v)}
                />
                <CounterRow
                  label="Souvenir"
                  value={form.souvenirCount}
                  onChange={(v) => setCounter('souvenirCount', v)}
                />
                <CounterRow
                  label="Titipan Gift"
                  value={form.titipanGiftCount}
                  onChange={(v) => setCounter('titipanGiftCount', v)}
                />
              </div>

              <div className="registration-footer">
                <button
                  type="button"
                  className="submit-btn"
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                >
                  {isSubmitting ? 'Saving…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
