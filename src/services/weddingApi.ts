import { weddingSiteContent, mockSubmitRsvp } from '../data/mockWedding'
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
  if (appConfig.useMockApi) {
    return {
      ...weddingSiteContent,
      integration: {
        modeLabel: 'Mock API active',
      },
    }
  }

  return requestJson<WeddingSiteContent>('/api/wedding')
}

export async function submitRsvp(request: RsvpRequest): Promise<RsvpResponse> {
  if (appConfig.useMockApi) {
    return mockSubmitRsvp(request)
  }

  return requestJson<RsvpResponse>('/api/rsvp', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
