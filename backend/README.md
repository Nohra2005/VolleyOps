# VolleyOps Backend

Flask backend for the VolleyOps project. It uses MySQL and creates the `DB_NAME` database automatically on first run if your MySQL server is reachable.

## Run

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Before starting, fill in `backend/.env` with the same MySQL connection style as your other backend project, but use a different `DB_NAME`, for example:

```env
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=volleyops
SECRET_KEY=choose_a_long_random_secret
OPENAI_API_KEY=
CORS_ORIGIN=http://localhost:5173
```

The API runs on `http://localhost:5000`.

## Included modules

- `Authentication`: login and demo seeded users
- `Scheduling`: facilities, teams, bookings, recurring exceptions
- `Club Management`: player/coach CRUD and profile data
- `Coach iBoard`: saved plays and duplication endpoint
- `Athlete Stats`: match stats, calculated metrics, AI feedback editing
- `Communications`: channels and messages
