ALTER TABLE invite_tokens ADD COLUMN created_by TEXT REFERENCES subjects(id);
