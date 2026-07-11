# Wedding Website Frontend

A responsive wedding invitation frontend built with React, TypeScript, and Vite. The UI is based on the supplied invitation page and includes:

- hero invitation layout for Jodie Justine
- event schedule cards
- RSVP form with guest list handling
- thank-you and decline states
- QR check-in placeholder for venue access
- API layer ready for a PHP backend on Hostinger

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

The frontend is cleanly separated from the backend and expects your PHP endpoints to serve the data.

- `src/services/weddingApi.ts` loads wedding content from `GET /api/wedding`
- `src/services/weddingApi.ts` submits RSVP data to `POST /api/rsvp`
- `src/reception/ReceptionApp.tsx` uses `GET /api/reception/group` and `POST /api/reception/checkin`
- `src/types/wedding.ts` defines the payload and response contracts

### Environment variables

```env
VITE_API_BASE_URL=https://your-api-domain.com
```

If your frontend and PHP API are served from the same domain, `VITE_API_BASE_URL` can be omitted and the app will call `/api/...` directly.

### Expected RSVP payload

```json
{
  "attendance": "yes",
  "guestIds": [2, 3],
  "groupId": 2
}
```

This repository no longer contains a Node or MySQL runtime. Database credentials should stay only in your Hostinger PHP configuration, not in the React app.
