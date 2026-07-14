export type AttendanceStatus = 'yes' | 'no'
export type GuestAttendance = 'Yes' | 'No' | 'Pending'

export interface CoupleContent {
  groomName: string
  groomLastName: string
  groomParents: string
  brideName: string
  brideLastName: string
  brideParents: string
  hashtag: string
  verse: string
  verseText: string
}

export interface Guest {
  id: number
  designation: 'Mr.' | 'Mrs.' | 'Ms.' | 'Child'
  firstName: string
  lastName: string
  attendance: GuestAttendance
  tableNo: number | null
  seatNo: number | null
}

export interface InvitationContent {
  groupId: number
  validPax: number
  guestGroupName: string
  guests: Guest[]
}

export interface ScheduleItem {
  time: string
  title: string
  subtitle?: string
  venue: string
  location: string
}

export interface WeddingDateContent {
  dateText: string
  weekday: string
}

export interface RsvpContent {
  deadline: string
}

export interface ContactContent {
  display: string
  whatsAppUrl: string
}

export interface ResponseContent {
  title: string
  body: string
}

export interface QrContent {
  message: string
}

export interface IntegrationContent {
  modeLabel: string
}

export interface WeddingSiteContent {
  couple: CoupleContent
  invitation: InvitationContent
  schedule: ScheduleItem[]
  weddingDate: WeddingDateContent
  rsvp: RsvpContent
  contact: ContactContent
  responses: {
    accepted: ResponseContent
    declined: ResponseContent
  }
  qr: QrContent
  integration: IntegrationContent
}

export interface RsvpRequest {
  attendance: AttendanceStatus
  groupId: number
  guestIds: number[]
}

export interface RsvpResponse {
  success: boolean
  message: string
  referenceId: string
}
