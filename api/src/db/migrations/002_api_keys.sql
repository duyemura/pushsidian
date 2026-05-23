CREATE TABLE api_keys (
    id TEXT PRIMARY KEY DEFAULT 'key_' || gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key_hash TEXT UNIQUE NOT NULL,
    label TEXT,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
