# Frontend

React + TypeScript + Vite based frontend for the task management app.

## Requirements

- Node.js 24 or later
- npm

## Environment Variables

This frontend reads the API base URL from `VITE_API_BASE_URL`.

Vite exposes only variables prefixed with `VITE_` to browser-side code via `import.meta.env`.
Relevant `.env` files are:

- `.env`
- `.env.local`
- `.env.development`
- `.env.production`
- `.env.[mode].local`

`.env.local` and `.env.[mode].local` are suitable for local-only values and should not be committed.

Create a local env file from the example:

```bash
cp .env.example .env.local
```

Example:

```env
VITE_API_BASE_URL=http://localhost:8000
```

The frontend currently uses this variable in [src/api/tasks.ts](./src/api/tasks.ts).

## Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The app is served at `http://localhost:5173`.

## Available Scripts

- `npm run dev`: start the Vite dev server
- `npm run build`: build the production bundle
- `npm run lint`: run ESLint
- `npm run preview`: preview the production build locally

## Docker Development

The development container uses bind mount for source files and keeps `node_modules` in a Docker named volume.

Typical command from the repository root:

```bash
docker compose up --build
```

## Notes

- Restart the Vite dev server after editing `.env` files.
- Use browser-reachable URLs for `VITE_API_BASE_URL`. For local development, `http://localhost:8000` is appropriate.
- For EC2, set `VITE_API_BASE_URL` to `http://<EC2_PUBLIC_IP>:8000`.
