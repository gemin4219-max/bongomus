-- Add allow_comments and allow_remix columns to tracks table
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT true;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS allow_remix BOOLEAN DEFAULT true;
