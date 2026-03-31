# VolleyOps Dashboard

Welcome to the **VolleyOps** development repository. This project is a specialized management dashboard designed for volleyball facilities, featuring a high-precision, custom-built scheduling engine.

---

## Prerequisites

Before setting up the environment, ensure you have the following installed:
* **Node.js** (v18.0.0 or higher)
* **npm** or **yarn**
* A code editor (VS Code recommended with ESLint enabled)

---

## Getting Started

Follow these steps to run the full project locally.

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd volleyops
   ```

2. **Start the backend**
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   python app.py
   ```
   The backend API will run on `http://localhost:5000`.

3. **Start the frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The frontend will run on `http://localhost:5173` and proxy `/api` requests to the backend.

## What is included

- `backend/`: Flask API, database models, seeded demo data, and endpoints for scheduling, club management, plays, stats, auth, and communications
- `frontend/`: React/Vite UI connected to the live backend for Scheduling, Club Management, and Player Profile flows
--- 
