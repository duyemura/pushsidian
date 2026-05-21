-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable uuid-ossp for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Subjects: users and groups unified
CREATE TABLE subjects (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('user', 'group')),
    clerk_id TEXT,
    email TEXT,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations (teams/companies)
CREATE TABLE organizations (
    id TEXT PRIMARY KEY DEFAULT 'org_' || gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    owner_id TEXT NOT NULL REFERENCES subjects(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Membership: user belongs to org
CREATE TABLE org_memberships (
    id TEXT PRIMARY KEY DEFAULT 'mem_' || gen_random_uuid(),
    org_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES subjects(id),
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- Groups within an org (e.g., Engineering, Product)
CREATE TABLE groups (
    id TEXT PRIMARY KEY DEFAULT 'grp_' || gen_random_uuid(),
    org_id TEXT NOT NULL REFERENCES organizations(id),
    display_name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, slug)
);

-- Group memberships
CREATE TABLE group_memberships (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES subjects(id),
    PRIMARY KEY (group_id, user_id)
);

-- Documents (metadata only)
CREATE TABLE documents (
    id TEXT PRIMARY KEY DEFAULT 'doc_' || gen_random_uuid(),
    org_id TEXT NOT NULL REFERENCES organizations(id),
    owner_id TEXT NOT NULL REFERENCES subjects(id),
    s3_key TEXT NOT NULL,
    vault_id TEXT NOT NULL,
    obsidian_path TEXT NOT NULL,
    title TEXT,
    content_hash TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document ACL: who can do what
CREATE TABLE document_rules (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id),
    relation TEXT NOT NULL CHECK (relation IN ('reader', 'writer', 'owner')),
    granted_by TEXT NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (document_id, subject_id)
);

-- Document chunks for vector search
CREATE TABLE document_chunks (
    id TEXT PRIMARY KEY DEFAULT 'chk_' || gen_random_uuid(),
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536),
    token_count INTEGER,
    UNIQUE(document_id, chunk_index)
);

-- Invite tokens for onboarding
CREATE TABLE invite_tokens (
    id TEXT PRIMARY KEY DEFAULT 'inv_' || gen_random_uuid(),
    org_id TEXT NOT NULL REFERENCES organizations(id),
    email TEXT NOT NULL,
    groups TEXT[],
    role TEXT DEFAULT 'member',
    token TEXT UNIQUE NOT NULL,
    used_by TEXT REFERENCES subjects(id),
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_doc_org ON documents(org_id);
CREATE INDEX idx_doc_owner ON documents(owner_id);
CREATE INDEX idx_doc_rules_subject ON document_rules(subject_id);
CREATE INDEX idx_doc_rules_doc ON document_rules(document_id);
CREATE INDEX idx_chunks_doc ON document_chunks(document_id);
CREATE INDEX idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_invite_token ON invite_tokens(token);
CREATE INDEX idx_org_memberships_user ON org_memberships(user_id);
