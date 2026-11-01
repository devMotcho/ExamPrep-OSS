-- Language of a user's reminder emails. NULL means not known yet: reminders then use English.
ALTER TABLE public.user_retention_settings
    ADD COLUMN locale character varying(2),
    ADD CONSTRAINT user_retention_settings_locale_check CHECK (locale IN ('pt', 'en'));

-- One row per user per day, counting uploads against MAX_UPLOADS_PER_DAY. Old rows are removed by UploadLimitService.
CREATE TABLE public.user_upload_usage (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    usage_date date NOT NULL,
    upload_count integer NOT NULL,
    PRIMARY KEY (user_id, usage_date)
);
