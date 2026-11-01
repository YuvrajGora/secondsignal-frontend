# SecondSignal

SecondSignal is a React + TypeScript fintech demo for verifying urgent money requests through a trusted-contact approval workflow.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Render deployment

This repository includes [`render.yaml`](./render.yaml) for a Render Static Site deployment:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- SPA fallback: all routes rewrite to `index.html`

The app runs in explicitly labelled demo mode when `VITE_API_BASE_URL` is not configured. Set that environment variable in Render when connecting a real backend.