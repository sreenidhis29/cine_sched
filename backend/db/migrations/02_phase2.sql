-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 Migrations: Reasoning Trace and Agent Memory
-- ─────────────────────────────────────────────────────────────────────────────

-- Reasoning Trace Table
CREATE TABLE IF NOT EXISTS reasoning_trace (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id UUID NOT NULL,
    agent_name VARCHAR NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    input_summary TEXT,
    output_summary TEXT,
    tool_calls JSONB DEFAULT '[]',
    duration_ms INTEGER,
    confidence VARCHAR(20) DEFAULT 'medium'
);

CREATE INDEX idx_reasoning_trace_project_run ON reasoning_trace(project_id, run_id);
CREATE INDEX idx_reasoning_trace_timestamp ON reasoning_trace(timestamp);

-- Agent Memory Table
CREATE TABLE IF NOT EXISTS agent_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    decision_type VARCHAR NOT NULL,
    context JSONB DEFAULT '{}',
    outcome TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_memory_project ON agent_memory(project_id);
