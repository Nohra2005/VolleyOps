# React + Vite (VolleyOps frontend)

This project uses Vite + React. The dev server proxies `/api` to `http://localhost:5000` by default (see `vite.config.js`).

Prerequisites
- Node.js 18+ and `npm` or `yarn`

Install and run

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` by default. The client uses relative `/api` paths (see `src/lib/api.js`), so the proxy in `vite.config.js` forwards those requests to the backend during development.

Changing the API host
- If your backend is on a different host/port in development, update the proxy in `vite.config.js` or change `src/lib/api.js` to prepend an absolute base URL.

Example: use an environment variable `VITE_API_BASE` and update `apiFetch` in `src/lib/api.js`:

```js
// at top of src/lib/api.js
const BASE = import.meta.env.VITE_API_BASE || '';

// then call fetch(BASE + path, ...)
```

Production build

```bash
npm run build
npm run preview
```

Linting

```bash
npm run lint
```