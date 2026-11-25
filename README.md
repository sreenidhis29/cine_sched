# CineSched

CineSched is an agentic film production scheduling platform. It uses Google OR-Tools (CP-SAT solver) for hard constraint satisfaction and LangGraph with LLMs (Groq / Gemini) to reason about constraint relaxations when a feasible schedule cannot be found.

## Architecture

- **Backend**: FastAPI, SQLAlchemy, PostgreSQL, LangGraph, Google OR-Tools, Groq (`llama-3.3-70b-versatile`), Google Gemini (`gemini-3.5-flash`).
- **Frontend**: Next.js 14, Tailwind CSS, Lucide React, Leaflet / React-Leaflet, Three.js, GSAP.
- **Database**: PostgreSQL (local Docker container or Supabase).

## Key Features

- **Script Parsing**: Upload production briefs/scripts (PDF) and extract scenes, cast, locations, and equipment using structured LLM calls.
- **Constraint-Based Scheduling**: CP-SAT solver for shoot-window planning, cast/equipment availability, and continuity tags, with LangGraph-powered constraint relaxation.
- **Route Planning**: Location-based route optimization using OSRM distance matrices, OR-Tools, and interactive Leaflet maps.
- **Resource & Organization Management**: CRUD for projects, scenes, cast, equipment, locations, and organization members.
- **Integrations**: Email notifications (Resend), Google Calendar sync, and PDF export.

## Prerequisites

- Node.js (v20+ / v24+) and npm
- Python (v3.11+)
- Docker (for local PostgreSQL) or a Supabase project
- Groq API Key and/or Google Gemini API Key

## Setup

1. **Clone the repository**

2. **Database Setup (Local Docker)**
   ```powershell
   docker run --name cinesched-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cinesched -p 5432:5432 -d postgres:15
   ```
   *(Alternatively, use a Supabase PostgreSQL connection string in `backend/.env`.)*

3. **Backend Setup**
   ```powershell
   cd backend
   python -m venv venv
   .\venv\Scripts\Activate.ps1   # On macOS/Linux: source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   ```
   Update `backend/.env` with your `DATABASE_URL` (e.g., `postgresql://postgres:postgres@localhost:5432/cinesched`), Supabase credentials, and `GEMINI_API_KEY` / `GROQ_API_KEY` (with `GEMINI_MODEL=gemini-3.5-flash`).

4. **Frontend Setup**
   ```powershell
   cd frontend
   npm install
   cp .env.local.example .env.local
   # Update .env.local with your Supabase URL/anon key and NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

## Running the Application

1. **Start the backend server**
   ```powershell
   cd backend
   .\venv\Scripts\Activate.ps1
   uvicorn main:app --reload
   ```

2. **Start the frontend development server**
   ```powershell
   cd frontend
   npm run dev
   ```

3. Open `http://localhost:3000` in your browser.

## Database Seeding

To seed the database with the sample short film "The Velvet Trap":

```powershell
# Ensure backend/.env is configured and PostgreSQL is running
cd scripts
python seed_db.py
```
