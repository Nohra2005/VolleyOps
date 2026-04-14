# VolleyOps Dashboard

Welcome to the VolleyOps development repository — a Flask + React/Vite app for managing volleyball facilities, scheduling, and player stats.

This README provides a high-level overview and quick start. For service-specific details see `backend/README.md` and `frontend/README.md`.

**Default ports**
- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173`

Prerequisites
- Python 3.10+ (for backend)
- Node.js 18+ and `npm` or `yarn` (for frontend)
- MySQL server accessible locally or remotely

Quick start (two terminals)

1) Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
# create backend/.env (see backend/.env.example)
python app.py
```

2) Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` requests to the backend (see `frontend/vite.config.js`). If you change the backend host or port, update the proxy or client code accordingly.

Troubleshooting
- If you get a runtime error that the `cryptography` package is required when connecting to MySQL, install it inside the backend virtualenv:

```powershell
.venv\Scripts\activate
python -m pip install --upgrade pip setuptools wheel
pip install cryptography
```

- If installing `cryptography` fails on Windows, try binary wheels only:

```powershell
pip install --only-binary=:all: cryptography
```

- Alternative: change the MySQL user to `mysql_native_password` on the server to avoid RSA encryption requirements:

```sql
ALTER USER 'your_user'@'your_host' IDENTIFIED WITH mysql_native_password BY 'your_password';
FLUSH PRIVILEGES;
```

Files and links
- [backend/README.md](backend/README.md) — backend setup and `.env` details
- [frontend/README.md](frontend/README.md) — frontend setup and dev server notes