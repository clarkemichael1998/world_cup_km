# KM Footy Deployment

This app needs a real Node server plus persistent storage. Do not deploy it as a static site.

## Recommended Hosting

Use a host that supports:

- Node.js server processes
- persistent disk/volume storage
- environment variables
- HTTPS public URL

Good fit for this version: Fly.io with a volume, or Render paid web service with persistent disk.

Avoid Vercel/Netlify for this SQLite version because their serverless filesystem is not a reliable persistent database location.

## Required Environment Variables

```env
FOOTBALL_DATA_API_KEY=your_football_data_token
SQLITE_DB_PATH=/data/km-footy.sqlite
```

For local development, `SQLITE_DB_PATH` is optional. The app defaults to:

```text
data/km-footy.sqlite
```

## Build and Start Commands

```bash
npm install
npm run build
npm run start
```

`npm run start` binds to `0.0.0.0`, so hosted platforms can route public traffic to it.

## Render Notes

Render free web services do not preserve local filesystem writes. Use a paid web service with a persistent disk.

Suggested settings:

- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Persistent disk mount: `/data`
- Environment:
  - `FOOTBALL_DATA_API_KEY`
  - `SQLITE_DB_PATH=/data/km-footy.sqlite`

## Fly.io Notes

Create a volume and mount it at `/data`.

Suggested environment:

```bash
fly secrets set FOOTBALL_DATA_API_KEY=your_football_data_token
fly secrets set SQLITE_DB_PATH=/data/km-footy.sqlite
```

## Pre-Share Checklist

Before sending the link to friends/family:

1. Create a fresh account via `/login`.
2. Add KM and reveal rewards.
3. Visit `/collection` and confirm cards persist after refresh.
4. Visit `/squad`, auto-pick or edit the XI, refresh and confirm it persists.
5. Visit `/live` and confirm the Result Feed says `football-data.org` with status `ok`.
6. Check that the public URL uses HTTPS.

## Current Production Caveat

SQLite is simple and good for a small family/friends app, but it should run as one server instance with one mounted disk. If you need multiple regions/instances later, move the database to Postgres.
