# Wedding Website Frontend

A responsive wedding invitation frontend built with React, TypeScript, and Vite. The UI is based on the supplied invitation page and includes:

- hero invitation layout for Jodie Justine
- event schedule cards
- RSVP form with guest list handling
- thank-you and decline states
- QR check-in placeholder for venue access
- backend-ready API layer with mock mode fallback

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run lint
```

## Backend preparation

The frontend already separates content loading and RSVP submission into a service layer.

- `src/services/weddingApi.ts` loads wedding content from `GET /api/wedding`
- `src/services/weddingApi.ts` submits RSVP data to `POST /api/rsvp`
- `src/types/wedding.ts` defines the payload and response contracts
- `.env.example` contains the API flags

### Environment variables

```env
VITE_USE_MOCK_API=true
VITE_API_BASE_URL=https://your-api-domain.com
```

### Expected RSVP payload

```json
{
  "attendance": "yes",
  "guestLabel": "Mr. / Mrs. / Ms.",
  "guestCount": 3,
  "guestNames": ["Guest 1", "Guest 2", "Guest 3"]
}
```

When `VITE_USE_MOCK_API=true`, the site runs entirely from local mock data. Set it to `false` and provide `VITE_API_BASE_URL` to connect a real backend.
