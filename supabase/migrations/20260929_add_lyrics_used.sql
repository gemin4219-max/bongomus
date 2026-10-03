-- Add lyrics_used column to profiles
-- Rule: user can generate lyrics as many times as they have credits
-- e.g. 1 credit = 1 lyrics generation, 5 credits = 5 lyrics generations

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lyrics_used INTEGER NOT NULL DEFAULT 0;

-- Ensure it never goes negative
ALTER TABLE public.profiles
  ADD CONSTRAINT lyrics_used_non_negative CHECK (lyrics_used >= 0);

-- When a user tops up credits (credits increases), reset lyrics_used to 0
-- so the new credit balance restores their lyrics quota fresh.
CREATE OR REPLACE FUNCTION public.reset_lyrics_used_on_topup()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.credits > OLD.credits THEN
    NEW.lyrics_used := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reset_lyrics_used ON public.profiles;
CREATE TRIGGER trg_reset_lyrics_used
  BEFORE UPDATE OF credits ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_lyrics_used_on_topup();
