export interface Subjects {
  id: string;
  type: "user" | "group";
  clerk_id: string | null;
  email: string | null;
  display_name: string;
  slack_handle: string | null;
  avatar_url: string | null;
  created_at: Date;
}

export interface Organizations {
  id: string;
  slug: string;
  display_name: string;
  owner_id: string;
  slack_webhook_url: string | null;
  created_at: Date;
}

export interface OrgMemberships {
  id: string;
  org_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at: Date;
}

export interface Groups {
  id: string;
  org_id: string;
  display_name: string;
  slug: string;
  created_at: Date;
}

export interface GroupMemberships {
  group_id: string;
  user_id: string;
}

export interface Documents {
  id: string;
  org_id: string;
  owner_id: string;
  s3_key: string;
  vault_id: string;
  obsidian_path: string;
  title: string | null;
  content_hash: string;
  version: number;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DocumentRules {
  document_id: string;
  subject_id: string;
  relation: "reader" | "writer" | "owner";
  granted_by: string;
  granted_at: Date;
}

export interface DocumentChunks {
  id: string;
  document_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: unknown; // pgvector
  token_count: number | null;
}

export interface InviteTokens {
  id: string;
  org_id: string;
  email: string | null;
  slack_handle: string | null;
  slack_user_id: string | null;
  groups: string[] | null;
  role: string;
  token: string;
  used_by: string | null;
  used_at: Date | null;
  created_by: string | null;
  expires_at: Date;
  created_at: Date;
}

export interface ApiKeys {
  id: string;
  user_id: string;
  org_id: string;
  key_hash: string;
  label: string | null;
  last_used_at: Date | null;
  created_at: Date;
}

export interface Migrations {
  name: string;
  executed_at: Date;
}

export interface DB {
  subjects: Subjects;
  organizations: Organizations;
  org_memberships: OrgMemberships;
  groups: Groups;
  group_memberships: GroupMemberships;
  documents: Documents;
  document_rules: DocumentRules;
  document_chunks: DocumentChunks;
  invite_tokens: InviteTokens;
  api_keys: ApiKeys;
  migrations: Migrations;
}
