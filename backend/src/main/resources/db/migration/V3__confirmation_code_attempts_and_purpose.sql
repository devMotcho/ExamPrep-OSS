-- A code now belongs to one purpose and allows a limited number of wrong guesses. Codes live for ten minutes,
-- so existing ones are simply dropped: anyone mid-flow asks for a new one.
DELETE FROM public.confirmation_codes;

ALTER TABLE public.confirmation_codes
    ADD COLUMN purpose character varying(30) NOT NULL,
    ADD COLUMN attempts integer NOT NULL DEFAULT 0;

CREATE INDEX idx_confirmation_codes_email_purpose ON public.confirmation_codes (email, purpose);

-- Codes sent per address per hour. Old rows are removed by ConfirmationCodeService.
CREATE TABLE public.confirmation_code_sends (
    email character varying(255) NOT NULL,
    window_start timestamp with time zone NOT NULL,
    send_count integer NOT NULL,
    PRIMARY KEY (email, window_start)
);
