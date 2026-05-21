import { z } from "zod";

export const SubjectType = z.enum(["user", "group"]);
export type SubjectType = z.infer<typeof SubjectType>;

export const Role = z.enum(["owner", "admin", "member"]);
export type Role = z.infer<typeof Role>;

export const DocumentRelation = z.enum(["reader", "writer", "owner"]);
export type DocumentRelation = z.infer<typeof DocumentRelation>;

export const OrganizationSchema = z.object({
  id: z.string(),
  slug: z.string(),
  display_name: z.string(),
  owner_id: z.string(),
  created_at: z.string().datetime(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const DocumentSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  owner_id: z.string(),
  s3_key: z.string(),
  vault_id: z.string(),
  obsidian_path: z.string(),
  title: z.string().nullable(),
  content_hash: z.string(),
  version: z.number().int(),
  is_deleted: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Document = z.infer<typeof DocumentSchema>;

export const DocumentRuleSchema = z.object({
  document_id: z.string(),
  subject_id: z.string(),
  relation: DocumentRelation,
  granted_by: z.string(),
  granted_at: z.string().datetime(),
});
export type DocumentRule = z.infer<typeof DocumentRuleSchema>;

export const GroupSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  display_name: z.string(),
  slug: z.string(),
  created_at: z.string().datetime(),
});
export type Group = z.infer<typeof GroupSchema>;
