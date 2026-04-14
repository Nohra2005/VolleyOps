# VolleyOps Backend

Flask backend for the VolleyOps project. It uses MySQL and will attempt to create the configured database on first run if the MySQL server is reachable.

## Prerequisites
- Python 3.10+
- MySQL server (local or remote)

## Setup

1. Create and activate a virtualenv (Windows example):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
```

2. Install Python dependencies:

```powershell
pip install -r requirements.txt
```

3. Create a `backend/.env` file (copy `backend/.env.example` or create manually). Required variables:

```
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=volleyops
SECRET_KEY=choose_a_long_random_secret
CORS_ORIGIN=http://localhost:5173
```

Optional variables:
- `OPENAI_API_KEY` — if you plan to use AI features in the project

Note: `db_config.py` validates that all required DB env vars are present and will raise an error if any are missing.

## Running the server

```powershell
.venv\Scripts\activate
python app.py
```

The API listens on `0.0.0.0:5000` by default.

## Common issues & fixes
- `RuntimeError: 'cryptography' package is required` — install `cryptography` inside the venv:

```powershell
python -m pip install --upgrade pip setuptools wheel
pip install cryptography
```

- If `cryptography` fails to build on Windows, try binary-only wheels:

```powershell
pip install --only-binary=:all: cryptography
```

- If you cannot install `cryptography`, change the MySQL user auth method on the server:

```sql
ALTER USER 'your_user'@'your_host' IDENTIFIED WITH mysql_native_password BY 'your_password';
FLUSH PRIVILEGES;
```

## Seeding and DB creation
- On first run the backend will call `ensure_database_exists()` and `seed_database()`; ensure your MySQL server credentials are correct so the database can be created/seeded.

## Included modules
- Authentication (login + seeded demo users)
- Scheduling (facilities, bookings, recurring rules)
- Club Management (players, coaches)
- Coach iBoard (plays)
- Athlete Stats (match stats and derived metrics)
- Communications (channels/messages)