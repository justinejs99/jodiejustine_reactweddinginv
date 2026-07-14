import { FormEvent, startTransition, useEffect, useState } from 'react'
import './App.css'
import { getWeddingSiteContent, submitRsvp } from './services/weddingApi'
import type { RsvpRequest, RsvpResponse, WeddingSiteContent } from './types/wedding'
import QRCode from 'qrcode'
import andImage from './assets/images/and.jpg'
import filmImage from './assets/images/FilmJJ.png'
import photoA from './assets/images/a.jpg'
import photoB from './assets/images/b.jpg'
import photoC from './assets/images/c.jpg'
import photoD from './assets/images/d.jpg'
import photoE from './assets/images/e.jpg'

function App() {
  const [content, setContent] = useState<WeddingSiteContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [response, setResponse] = useState<RsvpResponse | null>(null)
  const [formError, setFormError] = useState('')
  const [attendance, setAttendance] = useState<RsvpRequest['attendance']>('yes')
  const [selectedGuests, setSelectedGuests] = useState<boolean[]>([])
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadContent() {
      try {
        const siteContent = await getWeddingSiteContent()

        if (!isMounted) {
          return
        }

        setContent(siteContent)

        const guestAttendances = siteContent.invitation.guests.map((guest) => guest.attendance)
        const hasExistingRsvp = guestAttendances.some((status) => status !== 'Pending')

        if (hasExistingRsvp) {
          const selectedFromExistingRsvp = siteContent.invitation.guests.map((guest) => guest.attendance === 'Yes')
          const hasAttendingGuests = selectedFromExistingRsvp.some(Boolean)

          setSelectedGuests(selectedFromExistingRsvp)
          setAttendance(hasAttendingGuests ? 'yes' : 'no')
          setResponse({
            success: true,
            message: 'Loaded existing RSVP status.',
            referenceId: 'existing-rsvp',
          })
        } else {
          setSelectedGuests(new Array(siteContent.invitation.guests.length).fill(false))
          setAttendance('yes')
          setResponse(null)
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(error instanceof Error ? error.message : 'Unable to load the invitation at the moment.')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadContent()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!content) {
      setQrCodeDataUrl('')
      return
    }

    let isCancelled = false
    
    // Ensure the URL is constructed correctly relative to the current app path
    const baseUrl = window.location.href.split('?')[0].split('#')[0]
    const baseDir = baseUrl.endsWith('/') ? baseUrl : baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1)
    const qrTargetUrl = new URL(`reception.html?group=${content.invitation.groupId}`, baseDir).toString()

    QRCode.toDataURL(qrTargetUrl, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        if (!isCancelled) {
          setQrCodeDataUrl(dataUrl)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setQrCodeDataUrl('')
        }
      })

    return () => {
      isCancelled = true
    }
  }, [content])

  function toggleGuest(index: number) {
    setSelectedGuests((current) => {
      const next = [...current]
      next[index] = !next[index]
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!content) {
      return
    }

    if (attendance === 'yes') {
      const checkedCount = selectedGuests.filter(Boolean).length

      if (checkedCount === 0) {
        setFormError('Please select at least one attending guest.')
        return
      }
    }

    setFormError('')
    setIsSubmitting(true)

    try {
      const result = await submitRsvp({
        attendance,
        groupId: content.invitation.groupId,
        guestIds: attendance === 'yes'
          ? content.invitation.guests.filter((_, i) => selectedGuests[i]).map(g => g.id)
          : [],
      })

      startTransition(() => {
        setResponse(result)
      })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to submit your RSVP right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <main className="shell loading-state">Loading invitation...</main>
  }

  if (!content) {
    return <main className="shell loading-state">{loadError || 'Invitation content is unavailable.'}</main>
  }

  const guests = content.invitation.guests
  const hasValidGroup = content.invitation.groupId > 0
  const attendingGuests = guests.filter((_, i) => selectedGuests[i])
  const tableNumber = attendingGuests.find((guest) => guest.tableNo !== null)?.tableNo

  return (
    <main className="shell">
      <section className="hero-panel">
        <div className="hero-top">
          <p className="eyebrow">Wedding Invitation</p>
          <h1 className="hero-title">
            <span className="hero-title-line">
              <span>{content.couple.groomName}</span>
              <img className="hero-and-image" src={andImage} alt="and" />
            </span>
            <span className="hero-title-line">{content.couple.brideName}</span>
          </h1>
        </div>

        <div className="hero-footer">
          <div className="hero-middle">
            {hasValidGroup ? (
              <>
                <p className="card-label">Dear</p>
                <p className="guest-designation">{content.invitation.guestGroupName}</p>
                <div className="pax-badge">This invitation is valid for <strong>{content.invitation.validPax} pax</strong></div>
              </>
            ) : (
              <div style={{ height: '80px' }} /> 
            )}
          </div>

          <div className="hero-bottom">
            <p className="hero-hash">{content.couple.hashtag}</p>
            <p className="hero-date">{content.weddingDate.dateText}</p>
          </div>
        </div>
      </section>

      <section className="story-grid">
        <div className="panel family-details">
          <p className="family-invitation-text">
            Together with our families
            <br />
            we request the honour of your presence
            <br />
            to witness and celebrate the wedding of
          </p>
          
          <div className="family-sections"> 
              <div className="groom-section">
                <h2 className="groom-name">
                  <span className="groom-first-name">{content.couple.groomName}</span> 
                  <span className="groom-last-name">{content.couple.groomLastName}</span>
                </h2>
                <p className="family-parents">{content.couple.groomParents}</p>
              </div>
              
              {/* <p className="and-text">and</p> */}
              <img className="family-and-image" src={andImage} alt="and" />
              
              <div className="bride-section">
                <h2 className="bride-name">
                  <span className="bride-first-name">{content.couple.brideName}</span> 
                  <span className="bride-last-name">{content.couple.brideLastName}</span>
                </h2>
                <p className="family-parents">{content.couple.brideParents}</p>
              </div>
          </div>
          
          <div className="bible-verse">
            <p className="verse-reference">{content.couple.verse}</p>
            <p className="verse-reference">{content.couple.verseText}</p>
          </div>
        </div>

        <div className="panel event-details">
          <div className="film-strip-slider">
            <div className="film-strip-track">
              <img src={filmImage} alt="" />
              <img src={filmImage} alt="" />
              <img src={filmImage} alt="" />
            </div>
          </div>
          <p className="section-kicker">Wedding Date</p>
          <p className="day-display">{content.weddingDate.weekday}</p>
          <p className="date-display">{content.weddingDate.dateText}</p>
          <p className="section-kicker">Schedule Of Events</p>
          <div className="timeline">
            {content.schedule.map((eventItem) => (
              <div className="timeline-item" key={eventItem.title}>
                <div className="timeline-time">{eventItem.time}</div>
                <div>
                  <p className="timeline-title">{eventItem.title}</p>
                  {eventItem.subtitle ? <p className="timeline-subtitle">{eventItem.subtitle}</p> : null}
                  <p>{eventItem.venue}</p>
                  <p>{eventItem.location}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="polaroid-slider">
            <div className="polaroid-track">
              <div className="polaroid">
                <img src={photoA} alt="Photo 1" />
                <p className="polaroid-caption">memories</p>
              </div>
              <div className="polaroid">
                <img src={photoB} alt="Photo 2" />
                <p className="polaroid-caption">together</p>
              </div>
              <div className="polaroid">
                <img src={photoC} alt="Photo 3" />
                <p className="polaroid-caption">forever</p>
              </div>
              <div className="polaroid">
                <img src={photoD} alt="Photo 4" />
                <p className="polaroid-caption">love</p>
              </div>
              <div className="polaroid">
                <img src={photoE} alt="Photo 5" />
                <p className="polaroid-caption">us</p>
              </div>
              {/* Duplicated for seamless loop */}
              <div className="polaroid">
                <img src={photoA} alt="Photo 1" />
                <p className="polaroid-caption">memories</p>
              </div>
              <div className="polaroid">
                <img src={photoB} alt="Photo 2" />
                <p className="polaroid-caption">together</p>
              </div>
              <div className="polaroid">
                <img src={photoC} alt="Photo 3" />
                <p className="polaroid-caption">forever</p>
              </div>
              <div className="polaroid">
                <img src={photoD} alt="Photo 4" />
                <p className="polaroid-caption">love</p>
              </div>
              <div className="polaroid">
                <img src={photoE} alt="Photo 5" />
                <p className="polaroid-caption">us</p>
              </div>
            </div>
          </div>
        </div>


      </section>

      {hasValidGroup && (
        <section className="panel rsvp-panel">
          {!response && (
            <div className="rsvp-heading">
              <div>
                <p className="section-kicker">RSVP</p>
                <p className="valid-for">This invitation is valid for <strong>{content.invitation.validPax} pax</strong></p>
                <p className="date-note">Kindly RSVP by <strong>{content.rsvp.deadline}</strong></p>
              </div>
            </div>
          )}

          {/* ... existing response logic ... */}
          {response ? (
            <div className="rsvp-submitted">
              {attendance === 'yes' && (
                <div className="success-rsvp-card">
                  <p className="success-kicker">THE WEDDING OF</p>
                  <h2 className="success-couple-names">
                    <span>{content.couple.groomName.toUpperCase()}</span>
                    <img className="success-and-image" src={andImage} alt="and" />
                    <span>{content.couple.brideName.toUpperCase()}</span>
                  </h2>
                  <p className="success-date-text">{`${content.weddingDate.weekday}${content.weddingDate.dateText}`.toUpperCase()}</p>

                  <p className="success-qr-note">PLEASE SCREENSHOT THIS QR CODE<br />FOR CHECK IN AT THE VENUE</p>

                  {qrCodeDataUrl ? (
                    <div className="success-qr-shell" aria-label="Generated QR code">
                      <div className="success-qr-inner">
                        <img src={qrCodeDataUrl} alt="Reception check-in QR code" />
                      </div>
                    </div>
                  ) : (
                    <div className="success-qr-shell" aria-label="QR code loading">
                      <div className="success-qr-inner">
                        <span>QR CODE HERE</span>
                      </div>
                    </div>
                  )}

                  {tableNumber ? <p className="success-table-text">TABLE NUMBER: {tableNumber}</p> : null}

                  <button className="success-edit-rsvp-button" type="button" onClick={() => setResponse(null)}>
                    Edit RSVP
                  </button>
                </div>
              )}

              {attendance === 'no' && (
                <div className="submit-row" style={{ justifyContent: 'flex-start', marginBottom: 20 }}>
                  <button className="submit-button" type="button" onClick={() => setResponse(null)}>
                    Edit RSVP
                  </button>
                </div>
              )}

              <div> 
                <p className="bold-text-thankyou" style={{ paddingBottom: 0}}>{attendance === 'yes' ? content.responses.accepted.title : content.responses.declined.title}</p>
                <p className="normal-text-thankyou" style={{ paddingBottom: 20 }}>{attendance === 'yes' ? content.responses.accepted.body : content.responses.declined.body}</p> 
              </div>

              <div className="submitted-contact">
                <p className="bold-text" style={{ paddingBottom: 0 }}>For any queries please contact:</p>
                <a className="text-link" href={content.contact.whatsAppUrl} target="_blank" rel="noreferrer">
                  {content.contact.display}
                </a>
              </div>

        
            </div>
          ) : (
          <form className="rsvp-form" onSubmit={handleSubmit}>
            <p className="bold-text">Will you be attending our wedding?</p>
            <div className="attendance-toggle" role="radiogroup" aria-label="Attendance response">
              <button
                className={attendance === 'yes' ? 'toggle-button active' : 'toggle-button'}
                type="button"
                onClick={() => setAttendance('yes')}
              >
                Yes, with joy!
              </button>
              <button
                className={attendance === 'no' ? 'toggle-button active' : 'toggle-button'}
                type="button"
                onClick={() => setAttendance('no')}
              >
                Regretfully, I can't attend
              </button>
            </div>

            <p className="bold-text">Who will be attending?</p>

            <div className="guest-fields">
              {guests.map((guest, index) => (
                <label className="guest-checkbox" key={guest.id}>
                  <input
                    type="checkbox"
                    checked={selectedGuests[index] ?? false}
                    onChange={() => toggleGuest(index)}
                    disabled={attendance === 'no'}
                  />
                  <p className='normal-text'>{guest.designation} {guest.firstName} {guest.lastName}</p>
                </label>
              ))}
            </div>

            {formError ? <p className="form-message error">{formError}</p> : null}

            <div className="submit-row">
              <button className="submit-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending RSVP...' : 'RSVP'}
              </button>
            </div>
          </form>
          )}

        </section>
      )}
    </main>

  )
}

export default App
