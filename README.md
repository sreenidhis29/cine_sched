# CineSched

CineSched is an agentic film production scheduling platform. It uses Google OR-Tools (CP-SAT solver) for hard constraint satisfaction and LangGraph with LLMs (Groq / Gemini) to reason about constraint relaxations when a feasible schedule cannot be found.

## Architecture

- **Backend**: FastAPI, SQLAlchemy, PostgreSQL, LangGraph, OR-Tools, Groq (Llama-3), Google Gemini.
- **Frontend**: Next.js 14, Tailwind CSS, Lucide React.
- **Database**: PostgreSQL (via Supabase).

## Prerequisites

- Node.js (v24+) and npm
- Python (v3.11+)
- Docker (optional, for local DB)
- Supabase account and project
- Groq API Key
- Google Gemini API Key

## Setup

1. **Clone the repository**

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   # Update .env with your keys and Supabase credentials
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.local.example .env.local
   # Update .env.local with your Supabase URL/anon key
   ```

## Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   uvicorn main:app --reload
   ```

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm run dev
   ```

3. Open `http://localhost:3000` in your browser.

## Database Seeding

To seed the database with the sample short film "The Velvet Trap":

```bash
# Ensure backend is in python path and .env is configured
cd scripts
python seed_db.py
```

## Phase 1 Complete
Phase 1 implements the core scheduling pipeline, CP-SAT solver, LLM constraint relaxation agents, and a basic Next.js frontend setup.
