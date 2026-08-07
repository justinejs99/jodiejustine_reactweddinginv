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
  adultRsvpYes?: number | null
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

function extractGroupRef(text: string): string | null {
  const trimmed = text.trim()

  // Try parsing as a URL (e.g. https://.../reception.html?group=2 or ?group=abc123)
  try {
    const url = new URL(trimmed)
    const group = url.searchParams.get('group')
    const token = url.searchParams.get('token')
    if (group) {
      return group
    }
    if (token) return token
  } catch {
    // Not a URL, fall through.
  }

  // Accept raw token/id from QR payload.
  if (trimmed.length > 0) return trimmed

  return null
}

async function fetchCheckinGroup(groupRef: string): Promise<CheckinGroup> {
  const response = await fetch(
    `${appConfig.apiBaseUrl}/api/reception-group.php?id=${encodeURIComponent(groupRef)}`,
  )
  
  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Server configuration error (non-JSON response).')
  }

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Guest group not found.')
  }
  return data as CheckinGroup
}

async function fetchCheckinGroupByName(name: string): Promise<CheckinGroup> {
  const response = await fetch(
    `${appConfig.apiBaseUrl}/api/reception-group.php?name=${encodeURIComponent(name)}`,
  )
  
  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text()
    console.error('Server returned non-JSON response:', text)
    throw new Error('Server configuration error. Please check backend logs.')
  }

  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load guest information.')
  }
  
  return data as CheckinGroup
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
  onGroupId: (groupRef: string) => void
  onError: (msg: string) => void
  facingMode: 'environment' | 'user'
}

function QrScanner({ onGroupId, onError, facingMode }: QrScannerProps) {
  const hasScannedRef = useRef(false)
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)

  const safeStopScanner = async (instance: { stop: () => Promise<void> } | null) => {
    if (!instance) return
    try {
      await instance.stop()
    } catch {
      // Ignore stop errors when scanner has already stopped.
    }
  }

  useEffect(() => {
    let cancelled = false
    hasScannedRef.current = false

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelled) return

      // Clear any leftover DOM from a previous mount
      const el = document.getElementById(SCANNER_ELEMENT_ID)
      if (el) el.innerHTML = ''

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false })
      scannerRef.current = scanner

      const config = {
        fps: 10,
        qrbox: { width: 200, height: 200 },
        disableFlip: true
      }

      const startScanner = async () => {
        const onDecode = (decodedText: string) => {
          if (hasScannedRef.current || cancelled) return
          const groupRef = extractGroupRef(decodedText)
          if (groupRef !== null) {
            hasScannedRef.current = true
            void safeStopScanner(scanner)
            onGroupId(groupRef)
          }
        }

        const onScanError = () => {
          // per-frame scan errors – silently ignored
        }

        const cameraAttempts: Array<string | MediaTrackConstraints> = []

        try {
          const cameras = await Html5Qrcode.getCameras()
          if (cameras.length > 0) {
            const preferredPattern = facingMode === 'environment'
              ? /back|rear|environment/i
              : /front|user|facetime/i

            const preferredCamera = cameras.find((camera) => preferredPattern.test(camera.label))
            if (preferredCamera) {
              cameraAttempts.push(preferredCamera.id)
            }

            const fallbackCamera = cameras.find((camera) => camera.id !== preferredCamera?.id)
            if (fallbackCamera) {
              cameraAttempts.push(fallbackCamera.id)
            }
          }
        } catch {
          // Ignore and continue with fallback attempts.
        }

        // Fallback if camera enumeration is unavailable.
        cameraAttempts.push({ facingMode })
        cameraAttempts.push({ facingMode: facingMode === 'environment' ? 'user' : 'environment' })

        let lastError: unknown = null
        for (const attempt of cameraAttempts) {
          try {
            await scanner.start(attempt, config, onDecode, onScanError)
            return
          } catch (error) {
            lastError = error
          }
        }

        throw lastError ?? new Error('Unable to start camera scanner.')
      }

      startScanner()
        .catch(() => {
          if (!cancelled) onError('Camera access denied. Please allow camera permissions and reload.')
        })
    })

    return () => {
      cancelled = true
      void safeStopScanner(scannerRef.current)
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
  homeHref: string
}

function PageHeader({ homeHref }: PageHeaderProps) {
  return (
    <header className="reception-header">
      <a
        className="header-icon-btn"
        aria-label="Go to reception home"
        href={homeHref}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </a>

      <div className="header-title">
        <p className="header-eyebrow">Welcome to the wedding of</p>
        <h1 className="header-names">
          Jodie
          <img src={andImage} alt="and" className="header-and-img" />
          Justine
        </h1>
      </div>
    </header>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function ReceptionApp() {
  const [view, setView] = useState<View>('scanning')
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment')
  const [group, setGroup] = useState<CheckinGroup | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [printStatusMsg, setPrintStatusMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [lastSubmittedForm, setLastSubmittedForm] = useState<RegistrationForm | null>(null)
  const [form, setForm] = useState<RegistrationForm>({
    adultCount: 0,
    kidsCount: 0,
    giftCount: 0,
    souvenirCount: 0,
    titipanGiftCount: 0,
  })

  const handleGroupId = useCallback(async (groupRef: string) => {
    setView('loading')
    setPrintStatusMsg('')
    setLastSubmittedForm(null)
    try {
      const data = await fetchCheckinGroup(groupRef)
      setGroup(data)
      setForm({
        adultCount: data.adultRsvpYes ?? data.adultPax,
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

  // Auto-load from URL param: /reception.html?group=2 or /reception.html?group=abc123
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const groupParam = params.get('group')
    const tokenParam = params.get('token')
    if (groupParam) {
      handleGroupId(groupParam)
      return
    }
    if (tokenParam) {
      handleGroupId(tokenParam)
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
    setPrintStatusMsg('')
    setLastSubmittedForm(null)
    try {
      const data = await fetchCheckinGroupByName(fullName)
      setGroup(data)
      setForm({
        adultCount: data.adultRsvpYes ?? data.adultPax,
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
      setLastSubmittedForm({ ...form })
      setPrintStatusMsg('')
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
    setPrintStatusMsg('')
    setLastSubmittedForm(null)
  }

  function buildPrintHtml(groupName: string, count: number): string {
    const safeGroupName = groupName
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

    const labelItems = Array.from({ length: count }, (_, index) => {
      const labelText = `${safeGroupName} ${index + 1}/${count}`
      return `<section class="label"><p>${labelText}</p></section>`
    }).join('')

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Gift Labels</title>
    <style>
      @page {
        size: 40mm 30mm;
        margin: 0;
      }

      html,
      body {
        margin: 0;
        padding: 0;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      .label {
        width: 40mm;
        height: 30mm;
        display: flex;
        align-items: center;
        justify-content: center;
        page-break-after: always;
        break-after: page;
      }

      .label:last-child {
        page-break-after: auto;
        break-after: auto;
      }

      .label p {
        margin: 0;
        padding: 0 2.5mm;
        width: 100%;
        box-sizing: border-box;
        text-align: center;
        font-size: 3.2mm;
        line-height: 1.1;
        font-weight: 600;
        color: #000;
        word-break: break-word;
      }
    </style>
  </head>
  <body>${labelItems}</body>
</html>`
  }

  async function handlePrintLabels() {
    if (!group) {
      return
    }

    const source = lastSubmittedForm ?? form
    const labelCount = Math.max(0, source.giftCount) + Math.max(0, source.titipanGiftCount)

    if (labelCount < 1) {
      setPrintStatusMsg('Set Gift or Titipan Gift to at least 1 before printing.')
      return
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=420,height=420')

    if (!printWindow) {
      setPrintStatusMsg('Unable to open print preview. Please allow pop-ups and try again.')
      return
    }

    const printHtml = buildPrintHtml(group.groupName, labelCount)
    printWindow.document.open()
    printWindow.document.write(printHtml)
    printWindow.document.close()

    const triggerPrint = () => {
      printWindow.focus()
      printWindow.print()
    }

    if (printWindow.document.readyState === 'complete') {
      triggerPrint()
    } else {
      printWindow.addEventListener('load', triggerPrint, { once: true })
    }

    setPrintStatusMsg(`Opened print preview for ${labelCount} label${labelCount > 1 ? 's' : ''} (40mm x 30mm).`)
  }

  const basePath = window.location.pathname.includes('/JodieJustine/') ? '/JodieJustine' : ''
  const homeReceptionHref = `${basePath}/homereception.html`

  return (
    <div className="reception-shell">
      <PageHeader homeHref={homeReceptionHref} />

      <main className="reception-main">
        {/* ── SCANNING ── */}
        {view === 'scanning' && (
          <div className="scan-card-outer">
            <div className="scan-card-top">
              <p className="scan-card-label">Scan QR Code</p>
              <button
                type="button"
                className="camera-toggle-btn"
                aria-label={cameraFacingMode === 'environment' ? 'Switch to front camera' : 'Switch to back camera'}
                title={cameraFacingMode === 'environment' ? 'Switch to front camera' : 'Switch to back camera'}
                onClick={() => setCameraFacingMode((current) => current === 'environment' ? 'user' : 'environment')}
              >
                <svg className="camera-toggle-icon" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
                  <path d="M 22 12 C 16.486 12 12 16.486 12 22 L 12 23 C 12 24.104 12.896 25 14 25 C 15.104 25 16 24.104 16 23 L 16 22 C 16 18.691 18.691 16 22 16 L 42 16 C 45.309 16 48 18.691 48 22 L 48 24 L 45.107422 24 C 44.213422 24 43.685313 25.003281 44.195312 25.738281 L 49.089844 32.8125 C 49.529844 33.4495 50.471109 33.4495 50.912109 32.8125 L 55.806641 25.738281 C 56.314641 25.003281 55.788531 24 54.894531 24 L 52 24 L 52 22 C 52 16.486 47.514 12 42 12 L 22 12 z M 14 30.708984 C 13.654375 30.708984 13.308391 30.869 13.087891 31.1875 L 8.1953125 38.261719 C 7.6873125 38.996719 8.2134219 40 9.1074219 40 L 12 40 L 12 42 C 12 47.514 16.486 52 22 52 L 42 52 C 47.514 52 52 47.514 52 42 L 52 41 C 52 39.896 51.104 39 50 39 C 48.896 39 48 39.896 48 41 L 48 42 C 48 45.309 45.309 48 42 48 L 22 48 C 18.691 48 16 45.309 16 42 L 16 40 L 18.892578 40 C 19.786578 40 20.314688 38.996719 19.804688 38.261719 L 14.910156 31.1875 C 14.690156 30.869 14.345625 30.708984 14 30.708984 z" />
                </svg>
              </button>
            </div>
            <div className="scan-card-inner">
              <QrScanner
                key={cameraFacingMode}
                onGroupId={handleGroupId}
                onError={handleScanError}
                facingMode={cameraFacingMode}
              />
            </div>
            <form className="manual-entry-form manual-entry-form-stacked" onSubmit={handleManualSubmit}>
              <div className="manual-entry-input-row">
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
              </div>
              <button type="submit" className="manual-entry-btn manual-entry-submit">
                Find
              </button>
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
            <div className="success-copy">
              <p className="success-text">Check-in Successful!</p>
              <h2 className="success-name">{group.groupName}</h2>
              {group.tableNo && (
                <p className="success-table">
                  TABLE NUMBER: {group.tableNo}
                </p>
              )}
            </div>
            <div className="status-card-actions">
              <button type="button" className="submit-btn" onClick={() => setView('details')}>
                Edit Details
              </button>
              <button type="button" className="submit-btn" onClick={handleHome}>
                Next Guest
              </button>
            </div>
            {printStatusMsg ? <p className="print-status-text">{printStatusMsg}</p> : null}
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
                  onClick={handlePrintLabels}
                >
                  Print Labels
                </button>
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
