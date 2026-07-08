-- CineSched Phase 1 — Supabase/Postgres schema migration
-- Run this in the Supabase SQL editor or via psql.

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    description TEXT,
    owner_id    UUID NOT NULL,          -- references auth.users(id)
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON projects
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- LOCATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    address             TEXT,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    availability_start  DATE,
    availability_end    DATE,
    cost_per_day        NUMERIC(10,2) DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON locations
    USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
    WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- SCENES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scenes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scene_number        INTEGER NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT,
    setting             TEXT CHECK (setting IN ('INT','EXT','INT/EXT')) DEFAULT 'INT',
    time_of_day         TEXT CHECK (time_of_day IN ('DAY','NIGHT','DUSK','DAWN')) DEFAULT 'DAY',
    pages               NUMERIC(5,2) DEFAULT 1,
    duration_minutes    INTEGER DEFAULT 60,
    location_id         UUID REFERENCES locations(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON scenes
    USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
    WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- CAST MEMBERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cast_members (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    role                TEXT,
    availability_start  DATE,
    availability_end    DATE,
    cost_per_day        NUMERIC(10,2) DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cast_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON cast_members
    USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
    WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- EQUIPMENT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    quantity        INTEGER DEFAULT 1,
    cost_per_day    NUMERIC(10,2) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON equipment
    USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
    WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- BUDGETS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    total_limit     NUMERIC(12,2) NOT NULL DEFAULT 0,
    cast_cap        NUMERIC(12,2),
    location_cap    NUMERIC(12,2),
    equipment_cap   NUMERIC(12,2),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON budgets
    USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
    WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- SCENE_CAST  (junction)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scene_cast (
    scene_id        UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    cast_member_id  UUID NOT NULL REFERENCES cast_members(id) ON DELETE CASCADE,
    PRIMARY KEY (scene_id, cast_member_id)
);

ALTER TABLE scene_cast ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON scene_cast
    USING (
        scene_id IN (
            SELECT s.id FROM scenes s
            JOIN projects p ON p.id = s.project_id
            WHERE p.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        scene_id IN (
            SELECT s.id FROM scenes s
            JOIN projects p ON p.id = s.project_id
            WHERE p.owner_id = auth.uid()
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- SCENE_EQUIPMENT  (junction)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scene_equipment (
    scene_id        UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    equipment_id    UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    quantity_required INTEGER DEFAULT 1,
    PRIMARY KEY (scene_id, equipment_id)
);

ALTER TABLE scene_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON scene_equipment
    USING (
        scene_id IN (
            SELECT s.id FROM scenes s
            JOIN projects p ON p.id = s.project_id
            WHERE p.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        scene_id IN (
            SELECT s.id FROM scenes s
            JOIN projects p ON p.id = s.project_id
            WHERE p.owner_id = auth.uid()
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEDULES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id          UUID NOT NULL DEFAULT uuid_generate_v4(),
    total_cost      NUMERIC(12,2),
    is_feasible     BOOLEAN DEFAULT FALSE,
    is_accepted     BOOLEAN DEFAULT FALSE,
    explanation     TEXT,
    violations      JSONB DEFAULT '[]',
    relaxations     JSONB DEFAULT '[]',
    iteration_count INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON schedules
    USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
    WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEDULE_ENTRIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id     UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    scene_id        UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    shoot_day       INTEGER NOT NULL,
    shoot_date      DATE,
    start_time      TIME,
    end_time        TIME,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON schedule_entries
    USING (
        schedule_id IN (
            SELECT sc.id FROM schedules sc
            JOIN projects p ON p.id = sc.project_id
            WHERE p.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        schedule_id IN (
            SELECT sc.id FROM schedules sc
            JOIN projects p ON p.id = sc.project_id
            WHERE p.owner_id = auth.uid()
        )
    );
