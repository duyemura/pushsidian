-- Add Slack fields to invites
ALTER TABLE invite_tokens ALTER COLUMN email DROP NOT NULL;
ALTER TABLE invite_tokens ADD COLUMN slack_handle TEXT;
ALTER TABLE invite_tokens ADD COLUMN slack_user_id TEXT;
