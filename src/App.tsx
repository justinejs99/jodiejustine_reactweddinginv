import { FormEvent, startTransition, useEffect, useState } from 'react'
import './App.css'
import { getWeddingSiteContent, submitRsvp } from './services/weddingApi'
import type { RsvpRequest, RsvpResponse, WeddingSiteContent } from './types/wedding'
import andImage from './assets/images/and.jpg'

const emptyGuests = ['', '', '']

function App() {
  const [content, setContent] = useState<WeddingSiteContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [response, setResponse] = useState<RsvpResponse | null>(null)
  const [formError, setFormError] = useState('')
  const [attendance, setAttendance] = useState<RsvpRequest['attendance']>('yes')
  const [guestNames, setGuestNames] = useState<string[]>(emptyGuests)
  const [guestCount, setGuestCount] = useState(1)
  const [guestDesignation, setGuestDesignation] = useState('Mr. / Mrs. / Ms.')

  useEffect(() => {
    let isMounted = true

    async function loadContent() {
      try {
        const siteContent = await getWeddingSiteContent()

        if (!isMounted) {
          return
        }

        setContent(siteContent)
        setGuestCount(Math.min(siteContent.invitation.validPax, 3))
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

  function updateGuestName(index: number, value: string) {
    setGuestNames((currentGuests) => {
      const nextGuests = [...currentGuests]
      nextGuests[index] = value
      return nextGuests
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!content) {
      return
    }

    if (attendance === 'yes') {
      const filledGuests = guestNames.slice(0, guestCount).filter((guestName) => guestName.trim())

      if (filledGuests.length !== guestCount) {
        setFormError('Please enter a name for each attending guest.')
        return
      }
    }

    setFormError('')
    setIsSubmitting(true)

    try {
      const result = await submitRsvp({
        attendance,
        guestDesignation,
        guestCount,
        guestNames: attendance === 'yes' ? guestNames.slice(0, guestCount) : [],
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

  const attendingGuests = guestNames.slice(0, guestCount)

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
            <p className="card-label">Dear</p>
            <h2 className="guest-designation">{guestDesignation}</h2>
            <p className="guest-group-name">{content.invitation.guestGroupName}</p>
            <div className="pax-badge">This invitation is valid for {content.invitation.validPax} pax</div>
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
              
              <p className="and-text">and</p>
              
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
          </div>
        </div>
        
        <div className="panel event-details">
          <p className="section-kicker">Wedding Date</p>
          <p className="day-display">{content.weddingDate.weekday}</p>
          <p className="date-display">{content.weddingDate.dateText}</p>
          <p className="section-kicker">Schedule Of Events</p>
          <div className="timeline">
            {content.schedule.map((eventItem) => (
              <div className="timeline-item" key={eventItem.title}>
                <div className="timeline-time">{eventItem.time}</div>
                <div>
                  <p>{eventItem.title}</p>
                  {eventItem.subtitle ? <p className="timeline-subtitle">{eventItem.subtitle}</p> : null}
                  <p>{eventItem.venue}</p>
                  <p>{eventItem.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>


      </section>

      <section className="panel rsvp-panel">
        <div className="rsvp-heading">
          <div>
            <p className="section-kicker">RSVP</p>
            <h2>Will you be attending our wedding?</h2>
            <p>{content.rsvp.prompt}</p>
            <p className="date-note">Kindly RSVP by {content.rsvp.deadline}.</p>
            <a className="text-link" href={content.contact.whatsAppUrl} target="_blank" rel="noreferrer">
            Contact for queries
          </a>
          </div>
        </div>
        <div className="status-note">Submission mode: {content.integration.modeLabel}</div>
        <form className="rsvp-form" onSubmit={handleSubmit}>
          <label className="field wide-field">
            <span>Invitation name</span>
            <input
              value={guestDesignation}
              onChange={(event) => setGuestDesignation(event.target.value)}
              placeholder="Mr. / Mrs. / Ms."
            />
          </label>

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

          <div className="field-row">
            <label className="field">
              <span>Guest count</span>
              <select
                value={guestCount}
                onChange={(event) => setGuestCount(Number(event.target.value))}
                disabled={attendance === 'no'}
              >
                {Array.from({ length: content.invitation.validPax }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>
                    {count} guest{count > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>RSVP deadline</span>
              <input value={content.rsvp.deadline} disabled />
            </label>
          </div>

          <div className="guest-fields">
            <div className="guest-fields-heading">
              <h3>Who will be attending?</h3>
              <p>{attendance === 'yes' ? 'Complete the guest names below.' : 'Guest names are not required for a decline.'}</p>
            </div>

            {attendingGuests.map((guestName, index) => (
              <label className="field" key={`guest-${index + 1}`}>
                <span>Guest {index + 1}</span>
                <input
                  value={guestName}
                  onChange={(event) => updateGuestName(index, event.target.value)}
                  placeholder={`Guest ${index + 1} name`}
                  disabled={attendance === 'no'}
                />
              </label>
            ))}
          </div>

          {formError ? <p className="form-message error">{formError}</p> : null}
          {response ? <p className="form-message success">{response.message}</p> : null}

          <button className="submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending RSVP...' : 'Send RSVP'}
          </button>
        </form>
      </section>

      <section className="closing-grid">
        <article className="panel thank-you-panel">
          <p className="section-kicker">Thank You</p>
          <h2>{attendance === 'yes' ? content.responses.accepted.title : content.responses.declined.title}</h2>
          <p>{attendance === 'yes' ? content.responses.accepted.body : content.responses.declined.body}</p>
        </article>

        <article className="panel qr-panel">
          <p className="section-kicker">Venue Check-In</p>
          <h2>Please screenshot this QR code</h2>
          <p>{content.qr.message}</p>
          <div className="qr-placeholder" aria-label="QR code placeholder">
            <div className="qr-inner">
              <span>QR CODE</span>
              <small>Connect this block to a backend-generated guest token.</small>
            </div>
          </div>
          <a className="text-link" href={content.contact.whatsAppUrl} target="_blank" rel="noreferrer">
            {content.contact.display}
          </a>
        </article>
      </section>
    </main>
  )
}

export default App
