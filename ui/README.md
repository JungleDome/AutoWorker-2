# AutoWorker UI

A lightweight Vite + React + TypeScript frontend for the AutoWorker API. The UI uses Zustand for state, Tailwind CSS for styling, and shadcn-inspired UI primitives.

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Start the API server from the repository root (defaults to port 3000):

```bash
npm run dev
```

3. In another terminal, run the frontend dev server:

```bash
npm run dev -- --host --port 4173
```

The Vite dev server proxies `/api` and `/health` to `http://localhost:3000` by default. Override the backend URL by setting `VITE_API_BASE` in a `.env` file if needed.

## Features

- Ticket creation and selection
- Requirements capture form that posts to `/api/tickets/:ticketId/requirements`
- Read-only views for requirements, plan, execution results, and QA reports
- Shadcn-style UI primitives (button, card, input, textarea, badge)
