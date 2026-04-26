-- Elio IDE — Trace Engine schema
-- Run once against your Supabase project via the SQL editor or psql.

-- ---------------------------------------------------------------------------
-- runs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS runs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    status      TEXT        NOT NULL DEFAULT 'running'
                            CHECK (status IN ('running', 'completed', 'failed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_tokens INTEGER,
    total_cost  DECIMAL(12, 6)
);

-- ---------------------------------------------------------------------------
-- steps
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS steps (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      UUID        NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    type        TEXT        NOT NULL
                            CHECK (type IN (
                                'llm_call', 'tool_call', 'agent_handoff',
                                'memory_read', 'memory_write'
                            )),
    status      TEXT        NOT NULL
                            CHECK (status IN ('completed', 'running', 'failed')),
    input       JSONB,
    output      JSONB,
    latency_ms  INTEGER,
    token_count INTEGER,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS steps_run_id_idx        ON steps(run_id);
CREATE INDEX IF NOT EXISTS steps_run_timestamp_idx ON steps(run_id, timestamp);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps ENABLE ROW LEVEL SECURITY;

-- Permissive policies — tighten to auth.uid() checks when auth is wired up.
DROP POLICY IF EXISTS "allow_all_runs"  ON runs;
DROP POLICY IF EXISTS "allow_all_steps" ON steps;

CREATE POLICY "allow_all_runs"  ON runs  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_steps" ON steps FOR ALL USING (true) WITH CHECK (true);
