import { FormEvent, startTransition, useEffect, useRef, useState } from 'react'
import './App.css'
import { getWeddingSiteContent, submitRsvp } from './services/weddingApi'
import type { RsvpRequest, RsvpResponse, WeddingSiteContent } from './types/wedding'
import QRCode from 'qrcode'
import andImage from './assets/images/and.jpg'
import envelopeImage from './assets/images/envelope.png'
import envelopeOpenVideo from './assets/videos/envelope-open.mp4'
import preludeVideoMobile from './assets/videos/paperplanestopmo-mobile.mp4'
import preludeVideo from './assets/videos/paperplanestopmo.mp4'
import backgroundSong from './assets/song/howsweetitisjamestaylor.mp3'
// import filmImage from './assets/images/FilmJJ.png'

const envelopeVideoVersion = import.meta.env.VITE_ENVELOPE_VIDEO_VERSION ?? '2026-08-06-2'
let persistentBackgroundAudio: HTMLAudioElement | null = null

function shouldUseMobileVideo(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const isSmallScreen = window.matchMedia('(max-width: 900px)').matches
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection
  const isConstrainedNetwork = Boolean(connection?.saveData) || /2g|3g/i.test(connection?.effectiveType ?? '')

  return isSmallScreen || isConstrainedNetwork
}

const memoryPhotoModules = import.meta.glob('./assets/images/slide-cards-photos-optimized/cards*.jpg', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const memoryPhotos = Object.entries(memoryPhotoModules)
  .sort((a, b) => {
    const first = Number(a[0].match(/cards(\d+)\.jpg$/)?.[1] ?? 0)
    const second = Number(b[0].match(/cards(\d+)\.jpg$/)?.[1] ?? 0)
    return first - second
  })
  .map(([, src]) => src)

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
  const shellRef = useRef<HTMLElement | null>(null)
  const invitationContentRef = useRef<HTMLElement | null>(null)
  const envelopeVideoRef = useRef<HTMLVideoElement | null>(null)
  const preludeVideoRef = useRef<HTMLVideoElement | null>(null)
  const memoryCarouselRef = useRef<HTMLDivElement | null>(null)
  const [isEnvelopeOpen, setIsEnvelopeOpen] = useState(false)
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false)
  const [isVideoReady, setIsVideoReady] = useState(false)
  const [useMobileVideo, setUseMobileVideo] = useState(shouldUseMobileVideo)

  const activeEnvelopeVideo = envelopeOpenVideo
  const envelopeOpenVideoSrc = `${activeEnvelopeVideo}?v=${envelopeVideoVersion}`
  const preludeVideoSrc = useMobileVideo ? preludeVideoMobile : preludeVideo

  useEffect(() => {
    let isMounted = true

    async function loadContent() {
      try {
        const siteContent = await getWeddingSiteContent()

        if (!isMounted) {
          return
        }

        setContent(siteContent)

        const hasExistingRsvp = siteContent.invitation.groupRsvpStatus !== 'Pending'

        if (hasExistingRsvp) {
          const selectedFromExistingRsvp = siteContent.invitation.guests.map((guest) => guest.attendance === 'Yes')
          const isAttending = siteContent.invitation.groupRsvpStatus === 'Yes'

          setSelectedGuests(selectedFromExistingRsvp)
          setAttendance(isAttending ? 'yes' : 'no')
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
    if (typeof window === 'undefined') {
      return
    }

    if (!persistentBackgroundAudio) {
      persistentBackgroundAudio = new Audio(backgroundSong)
      persistentBackgroundAudio.preload = 'auto'
      persistentBackgroundAudio.loop = true
      persistentBackgroundAudio.volume = 1
    }

    const audio = persistentBackgroundAudio
    const interactionEvents: Array<keyof WindowEventMap> = ['pointerdown', 'touchstart', 'keydown']

    const unlockAndPlay = () => {
      void audio.play().catch(() => {
        // Keep trying on future interactions until playback is allowed.
      })
    }

    unlockAndPlay()

    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, unlockAndPlay)
    })

    return () => {
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, unlockAndPlay)
      })
    }
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)')
    const updateVideoPreference = () => {
      setUseMobileVideo(shouldUseMobileVideo())
    }

    updateVideoPreference()
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateVideoPreference)
    } else {
      mediaQuery.addListener(updateVideoPreference)
    }

    const connection = (navigator as Navigator & {
      connection?: { addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void }
    }).connection

    connection?.addEventListener?.('change', updateVideoPreference)

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', updateVideoPreference)
      } else {
        mediaQuery.removeListener(updateVideoPreference)
      }
      connection?.removeEventListener?.('change', updateVideoPreference)
    }
  }, [])

  useEffect(() => {
    if (!content) {
      return
    }

    const carousel = memoryCarouselRef.current

    if (!carousel) {
      return
    }

    let animationFrameId = 0
    let previousTimestamp = 0
    const autoScrollSpeed = 42

    const animate = (timestamp: number) => {
      if (!previousTimestamp) {
        previousTimestamp = timestamp
      }

      const elapsed = timestamp - previousTimestamp
      previousTimestamp = timestamp

      if (carousel.scrollWidth <= carousel.clientWidth) {
        animationFrameId = window.requestAnimationFrame(animate)
        return
      }

      const maxScrollLeft = carousel.scrollWidth - carousel.clientWidth
      const nextScrollLeft = carousel.scrollLeft - (autoScrollSpeed * elapsed) / 1000

      carousel.scrollLeft = nextScrollLeft <= 0 ? maxScrollLeft : nextScrollLeft
      animationFrameId = window.requestAnimationFrame(animate)
    }

    if (carousel.scrollWidth > carousel.clientWidth) {
      carousel.scrollLeft = carousel.scrollWidth - carousel.clientWidth
    }

    animationFrameId = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [content])

  useEffect(() => {
    // Warm the envelope-open video early so tap-to-open feels immediate on mobile.
    setShouldLoadVideo(true)
  }, [])

  useEffect(() => {
    if (!isEnvelopeOpen || !shouldLoadVideo) {
      setIsVideoReady(false)
      return
    }

    const video = envelopeVideoRef.current

    if (!video) {
      return
    }

    const handleReady = () => {
      setIsVideoReady(true)
    }

    const handleEnded = () => {
    }

    const handleError = () => {
      setIsVideoReady(false)
    }

    if (video.readyState >= 2) {
      handleReady()
    } else {
      video.addEventListener('loadeddata', handleReady)
      video.addEventListener('canplay', handleReady)
      video.addEventListener('canplaythrough', handleReady)
      video.addEventListener('error', handleError)
    }

    video.addEventListener('ended', handleEnded)

    video.currentTime = 0
    video.playbackRate = 1.12
    void video.play().catch(() => {
      // If autoplay is blocked, keep the invitation open with static poster.
    })

    return () => {
      video.pause()
      video.removeEventListener('loadeddata', handleReady)
      video.removeEventListener('canplay', handleReady)
      video.removeEventListener('canplaythrough', handleReady)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      setIsVideoReady(false)
    }
  }, [isEnvelopeOpen, shouldLoadVideo])

  useEffect(() => {
    const video = preludeVideoRef.current

    if (!video) {
      return
    }

    video.loop = true
    video.muted = true
    video.playbackRate = 1
    video.preload = useMobileVideo ? 'metadata' : 'auto'

    void video.play().catch(() => {
      // Keep video configured to autoplay as soon as the browser allows it.
    })
  }, [useMobileVideo])

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
  const shouldHideRsvpIntro = Boolean(response && attendance === 'yes' && qrCodeDataUrl)

  function openInvitation() {
    if (isEnvelopeOpen) {
      const video = envelopeVideoRef.current
      const shell = shellRef.current

      if (video) {
        video.pause()
        video.currentTime = 0
      }

      shell?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      setIsVideoReady(false)
      setIsEnvelopeOpen(false)
      return
    }

    setShouldLoadVideo(true)
    setIsVideoReady(false)
    setIsEnvelopeOpen(true)
  }

  const isScrollUnlocked = isEnvelopeOpen

  return (
    <main ref={shellRef} className={isScrollUnlocked ? 'shell is-unlocked' : 'shell is-locked'}>
      <section className="hero-panel landing-panel">
        <div className="landing-copy">
          <p className="landing-kicker">DEAR</p>
          <p className="landing-guest-name">{content.invitation.guestGroupName}</p>
          <p className="landing-pax-note">
            This invitation is valid for <strong>{content.invitation.validPax} pax</strong>
          </p>
        </div>

        <button className="landing-media-stage" type="button" onClick={openInvitation} aria-label="Open invitation">
          <img
            className={isEnvelopeOpen ? 'landing-envelope-image is-faded' : 'landing-envelope-image'}
            src={envelopeImage}
            alt="Envelope invitation"
          />
          {shouldLoadVideo ? (
            <video
              ref={envelopeVideoRef}
              className={isEnvelopeOpen && isVideoReady ? 'landing-envelope-video is-visible' : 'landing-envelope-video'}
              src={envelopeOpenVideoSrc}
              poster={envelopeImage}
              playsInline
              preload="auto"
              muted
            />
          ) : null}
        </button>
      </section>

      <section className="story-grid" ref={invitationContentRef}>
        <div className="panel prelude-panel" aria-label="Wedding prelude page">
          <video
            ref={preludeVideoRef}
            className="prelude-bg-video"
            src={preludeVideoSrc}
            autoPlay
            loop
            muted
            playsInline
            preload={useMobileVideo ? 'metadata' : 'auto'}
          />
        </div>

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
          {/*
          <div className="film-strip-slider">
            <div className="film-strip-track">
              <img src={filmImage} alt="" />
              <img src={filmImage} alt="" />
              <img src={filmImage} alt="" />
            </div>
          </div>
          */}
          <div className="panel-card event-details-card">
            <p className="section-kicker">Wedding Date</p>
            <div className="wedding-date-line">
              <p className="day-display">{content.weddingDate.weekday}</p>
              <p className="date-display">{content.weddingDate.dateText}</p>
            </div>
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
          </div>

          <section className="memory-gallery" aria-label="Wedding memories gallery">
            <div ref={memoryCarouselRef} className="memory-carousel" role="region" aria-label="Swipe to browse gallery photos">
              {memoryPhotos.map((photo, index) => (
                <article className="memory-slide" key={photo}>
                  <img src={photo} alt={`Memory card ${index + 1}`} loading="lazy" decoding="async" />
                </article>
              ))}
            </div>
          </section>
        </div>


      </section>

      {hasValidGroup && (
        <section className="panel rsvp-panel">
          <div className={response ? 'panel-card rsvp-content-card is-submitted' : 'panel-card rsvp-content-card'}>
            {!shouldHideRsvpIntro && (
              <div className="rsvp-heading">
                <div>
                  <p className="section-kicker">RSVP</p>
                  <p className="valid-for">This invitation is valid for <strong>{content.invitation.validPax} pax</strong></p>
                  <p className="date-note">Kindly RSVP by <strong>{content.rsvp.deadline}</strong></p>
                </div>
              </div>
            )}

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
                  <p className="bold-text-thankyou" style={{ paddingBottom: 0 }}>{attendance === 'yes' ? content.responses.accepted.title : content.responses.declined.title}</p>
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
          </div>
        </section>
      )}
    </main>

  )
}

export default App
