-- Refresh tokens are stored as SHA-256 hashes from now on. Existing rows hold usable tokens and cannot be
-- converted in a way that keeps families, so they are deleted: everyone signs in again once.
DELETE FROM public.refresh_tokens;

ALTER TABLE public.refresh_tokens RENAME COLUMN token TO token_hash;

ALTER TABLE public.refresh_tokens
    ADD COLUMN family_id uuid NOT NULL,
    ADD COLUMN rotated_at timestamp with time zone;

CREATE INDEX idx_refresh_tokens_family ON public.refresh_tokens (family_id);
CREATE INDEX idx_refresh_tokens_expiry ON public.refresh_tokens (expiry_date);
