import type { RsvpRequest, RsvpResponse, WeddingSiteContent } from '../types/wedding'

export const weddingSiteContent: WeddingSiteContent = {
  couple: {
    groomName: 'Jodie',
    groomLastName: 'Setiawan',
    groomParents: 'SON OF MR. HARLY SETIAWAN & MRS. SUSAN DARMANTO',
    brideName: 'Justine',
    brideLastName: 'Joy',
    brideParents: 'DAUGHTER OF MR. RONY SUTRISNO & MRS. VIVI ISWANTI',
    hashtag: '#JODohnyaJJ',
    verse: 'Matthew 19:6\n"Therefore what God has joined together,\nlet no one separate."',
  },
  invitation: {
    groupId: 2,
    validPax: 3,
    guestGroupName: 'Gany Family',
    guests: [
      { id: 2, designation: 'Mr.', firstName: 'Sinaga', lastName: 'Gany', attendance: 'Yes', tableNo: 4, seatNo: 1 },
      { id: 3, designation: 'Mrs.', firstName: 'Yuliani', lastName: 'Thio', attendance: 'Yes', tableNo: 4, seatNo: 2 },
      { id: 4, designation: 'Mr.', firstName: 'Henry', lastName: 'Gany', attendance: 'Yes', tableNo: 5, seatNo: 3 },
    ],
  },
  schedule: [
    {
      time: '09:00 WITA',
      title: 'Holy Matrimony',
      venue: 'Hotel Mercure Samarinda',
      location: 'Crystal Ballroom 5 - Lt. 5',
    },
    {
      time: '11:00 WITA',
      title: 'Tea Pai Ceremony & Lunch',
      venue: 'Hotel Mercure Samarinda',
      location: 'Crystal Ballroom 5 - Lt. 5',
    },
    {
      time: '18:30 WITA',
      title: 'Wedding Reception',
      subtitle: 'Followed by After Party',
      venue: 'Hotel Mercure Samarinda',
      location: 'Crystal Ballroom - Lt. 3',
    },
  ],
  weddingDate: {
    dateText: '10.10.26',
    weekday: 'Saturday, ',
  },
  rsvp: {
    deadline: 'Sat, 26/09/26',
  },
  contact: {
    display: 'wa.me/6281389834762',
    whatsAppUrl: 'https://wa.me/6281389834762',
  },
  responses: {
    accepted: {
      title: 'Thank you for your response!',
      body: "We can't wait to see you there.",
    },
    declined: {
      title: 'We will miss celebrating with you!',
      body: 'We truly appreciate your love and support, even from afar.',
    },
  },
  qr: {
    message: 'Use this block as the venue check-in area. In production, the QR image should be generated per guest record and returned by the backend.',
  },
  integration: {
    modeLabel: 'Mock API active',
  },
}

export async function mockSubmitRsvp(request: RsvpRequest): Promise<RsvpResponse> {
  await new Promise((resolve) => window.setTimeout(resolve, 800))

  const attendingCount = request.guestIds.length
  const message = request.attendance === 'yes'
    ? `Your RSVP for ${attendingCount} guest${attendingCount > 1 ? 's have' : ' has'} been saved.`
    : 'We have recorded your regret response.'

  return {
    success: true,
    message,
    referenceId: `RSVP-G${request.groupId}`,
  }
}
