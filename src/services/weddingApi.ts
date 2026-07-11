import { appConfig } from '../lib/config'
import type { RsvpRequest, RsvpResponse, WeddingSiteContent } from '../types/wedding'

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}.`)
  }

  return response.json() as Promise<T>
}

export async function getWeddingSiteContent(): Promise<WeddingSiteContent> {
  const params = new URLSearchParams(window.location.search)
  const name = params.get('invitation_name')
  const group = params.get('group')

  if (name) {
    return requestJson<WeddingSiteContent>(`/api/wedding.php?name=${encodeURIComponent(name)}`)
  }

  const groupId = group || '1'
  return requestJson<WeddingSiteContent>(`/api/wedding.php?group=${encodeURIComponent(groupId)}`)
}

export async function submitRsvp(request: RsvpRequest): Promise<RsvpResponse> {
  return requestJson<RsvpResponse>('/api/rsvp.php', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
