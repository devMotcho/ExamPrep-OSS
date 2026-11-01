-- ExamPrep database baseline.

CREATE TABLE public.ai_generation_jobs (
    id uuid NOT NULL,
    user_id uuid,
    study_area_id uuid,
    status character varying(20) NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    provider character varying(20) NOT NULL,
    model character varying(100) NOT NULL,
    original_filename character varying(255),
    page_count integer NOT NULL,
    attempts integer DEFAULT 1 NOT NULL,
    error_code character varying(50),
    input_tokens bigint DEFAULT 0 NOT NULL,
    output_tokens bigint DEFAULT 0 NOT NULL,
    cost_usd numeric(12,6) DEFAULT 0 NOT NULL,
    reserved_usd numeric(12,6) DEFAULT 0 NOT NULL,
    result_json text,
    saved_count integer,
    consent_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    last_attempt_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(120) NOT NULL,
    locale character varying(2) NOT NULL,
    title character varying(160) NOT NULL,
    excerpt character varying(300) DEFAULT ''::character varying NOT NULL,
    content_md text DEFAULT ''::text NOT NULL,
    feature_key character varying(50),
    status character varying(10) DEFAULT 'DRAFT'::character varying NOT NULL,
    author_id uuid,
    author_name character varying(120) NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cover_url character varying(500),
    CONSTRAINT blog_posts_locale_check CHECK (((locale)::text = ANY ((ARRAY['pt'::character varying, 'en'::character varying])::text[]))),
    CONSTRAINT blog_posts_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'PUBLISHED'::character varying])::text[])))
);

CREATE TABLE public.chapters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    study_area_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    order_index integer DEFAULT 0
);

CREATE TABLE public.confirmation_codes (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    code character varying(10) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.contact_message_statuses (
    id uuid NOT NULL,
    name character varying(50) NOT NULL,
    color character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.contact_messages (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    subject character varying(150) NOT NULL,
    message text NOT NULL,
    ip_address character varying(45),
    is_read boolean DEFAULT false NOT NULL,
    sent_channels character varying(255) DEFAULT ''::character varying NOT NULL,
    type character varying(50) DEFAULT 'CONTACT'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status_id uuid,
    reply_message text
);

CREATE TABLE public.device_telemetry (
    device_id character varying(100) NOT NULL,
    is_authenticated boolean DEFAULT false,
    user_id uuid,
    last_seen_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.exam_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    study_area_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    settings text NOT NULL,
    final_score numeric(3,1),
    practice_of_session_id uuid,
    session_kind character varying(16) DEFAULT 'EXAM'::character varying NOT NULL,
    CONSTRAINT exam_sessions_session_kind_check CHECK (((session_kind)::text = ANY ((ARRAY['EXAM'::character varying, 'SIMULATION'::character varying, 'PLAN'::character varying, 'PRACTICE_WRONG'::character varying, 'MARKED'::character varying])::text[])))
);

CREATE TABLE public.gallery_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    filename character varying(255) NOT NULL,
    s3_key text NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    uploaded_by uuid,
    folder character varying(255)
);

CREATE TABLE public.login_lockouts (
    id uuid NOT NULL,
    ip_address character varying(45) NOT NULL,
    username character varying(255) NOT NULL,
    failed_attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    locked_until bigint
);

CREATE TABLE public.options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    text text NOT NULL
);

CREATE TABLE public.query_telemetry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recorded_date date NOT NULL,
    query_count bigint DEFAULT 0
);

CREATE TABLE public.question_marks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    question_id uuid,
    study_area_id uuid,
    area_title character varying(255) NOT NULL,
    marked boolean DEFAULT false NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_question_marks_not_empty CHECK ((marked OR (note IS NOT NULL))),
    CONSTRAINT question_marks_note_check CHECK (((note IS NULL) OR ((char_length(note) >= 1) AND (char_length(note) <= 1000))))
);

CREATE TABLE public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    study_area_id uuid NOT NULL,
    prompt text NOT NULL,
    image_url character varying(512),
    correct_option_id uuid,
    explanation text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    chapter_id uuid,
    order_index integer DEFAULT 0
);

CREATE TABLE public.refresh_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token character varying(255) NOT NULL,
    expiry_date timestamp with time zone NOT NULL,
    revoked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.session_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    question_id uuid NOT NULL,
    selected_option_id uuid,
    answered_at timestamp with time zone DEFAULT now() NOT NULL,
    correct boolean NOT NULL
);

CREATE TABLE public.site_config (
    config_key character varying(255) NOT NULL,
    config_value text NOT NULL,
    config_type character varying(50) NOT NULL,
    label character varying(255) NOT NULL,
    config_group character varying(100) NOT NULL,
    default_value text,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.study_areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    created_by uuid NOT NULL,
    visibility character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_exam_dates (
    user_id uuid NOT NULL,
    study_area_id uuid NOT NULL,
    exam_date date NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_exam_setups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    study_area_id uuid NOT NULL,
    name character varying(60) NOT NULL,
    preset character varying(16) NOT NULL,
    settings jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_exam_setups_preset_check CHECK (((preset)::text = ANY ((ARRAY['TRAINING'::character varying, 'SIMULATION'::character varying])::text[])))
);

CREATE TABLE public.user_retention_settings (
    user_id uuid NOT NULL,
    daily_goal_questions integer DEFAULT 10 NOT NULL,
    reminder_frequency character varying(10) DEFAULT 'OFF'::character varying NOT NULL,
    reminder_consent_at timestamp with time zone,
    unsubscribe_token uuid DEFAULT gen_random_uuid() NOT NULL,
    last_reminder_sent_on date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_retention_settings_daily_goal_questions_check CHECK (((daily_goal_questions >= 1) AND (daily_goal_questions <= 500))),
    CONSTRAINT user_retention_settings_reminder_frequency_check CHECK (((reminder_frequency)::text = ANY ((ARRAY['OFF'::character varying, 'DAILY'::character varying, 'WEEKLY'::character varying])::text[])))
);

CREATE TABLE public.user_study_areas (
    user_id uuid NOT NULL,
    study_area_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    name character varying(255),
    phone character varying(50),
    is_active boolean DEFAULT true,
    last_login_at timestamp with time zone,
    is_confirmed boolean DEFAULT true NOT NULL,
    oauth_provider character varying(50),
    oauth_subject character varying(255)
);

ALTER TABLE ONLY public.ai_generation_jobs
    ADD CONSTRAINT ai_generation_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_locale_key UNIQUE (slug, locale);

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.confirmation_codes
    ADD CONSTRAINT confirmation_codes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.contact_message_statuses
    ADD CONSTRAINT contact_message_statuses_name_key UNIQUE (name);

ALTER TABLE ONLY public.contact_message_statuses
    ADD CONSTRAINT contact_message_statuses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.device_telemetry
    ADD CONSTRAINT device_telemetry_pkey PRIMARY KEY (device_id);

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.gallery_images
    ADD CONSTRAINT gallery_images_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.gallery_images
    ADD CONSTRAINT gallery_images_s3_key_key UNIQUE (s3_key);

ALTER TABLE ONLY public.login_lockouts
    ADD CONSTRAINT login_lockouts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.query_telemetry
    ADD CONSTRAINT query_telemetry_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.query_telemetry
    ADD CONSTRAINT query_telemetry_recorded_date_key UNIQUE (recorded_date);

ALTER TABLE ONLY public.question_marks
    ADD CONSTRAINT question_marks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_key UNIQUE (token);

ALTER TABLE ONLY public.session_answers
    ADD CONSTRAINT session_answers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.site_config
    ADD CONSTRAINT site_config_pkey PRIMARY KEY (config_key);

ALTER TABLE ONLY public.study_areas
    ADD CONSTRAINT study_areas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.login_lockouts
    ADD CONSTRAINT uq_ip_address UNIQUE (ip_address);

ALTER TABLE ONLY public.question_marks
    ADD CONSTRAINT uq_question_marks_user_question UNIQUE (user_id, question_id);

ALTER TABLE ONLY public.user_exam_dates
    ADD CONSTRAINT user_exam_dates_pkey PRIMARY KEY (user_id, study_area_id);

ALTER TABLE ONLY public.user_exam_setups
    ADD CONSTRAINT user_exam_setups_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_retention_settings
    ADD CONSTRAINT user_retention_settings_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.user_retention_settings
    ADD CONSTRAINT user_retention_settings_unsubscribe_token_key UNIQUE (unsubscribe_token);

ALTER TABLE ONLY public.user_study_areas
    ADD CONSTRAINT user_study_areas_pkey PRIMARY KEY (user_id, study_area_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

CREATE INDEX idx_ai_generation_jobs_area_user ON public.ai_generation_jobs USING btree (study_area_id, user_id, created_at DESC);

CREATE INDEX idx_ai_generation_jobs_attempt ON public.ai_generation_jobs USING btree (last_attempt_at);

CREATE INDEX idx_ai_generation_jobs_status ON public.ai_generation_jobs USING btree (status, updated_at);

CREATE INDEX idx_ai_generation_jobs_user_created ON public.ai_generation_jobs USING btree (user_id, created_at DESC);

CREATE INDEX idx_blog_posts_feature ON public.blog_posts USING btree (locale, feature_key) WHERE ((status)::text = 'PUBLISHED'::text);

CREATE INDEX idx_blog_posts_public ON public.blog_posts USING btree (locale, published_at DESC) WHERE ((status)::text = 'PUBLISHED'::text);

CREATE INDEX idx_confirmation_codes_created_at ON public.confirmation_codes USING btree (created_at DESC);

CREATE INDEX idx_confirmation_codes_email ON public.confirmation_codes USING btree (email);

CREATE INDEX idx_contact_messages_created_at ON public.contact_messages USING btree (created_at DESC);

CREATE INDEX idx_contact_messages_is_read ON public.contact_messages USING btree (is_read);

CREATE INDEX idx_contact_messages_type ON public.contact_messages USING btree (type);

CREATE INDEX idx_exam_sessions_owner_kind ON public.exam_sessions USING btree (user_id, study_area_id, session_kind, completed_at DESC);

CREATE INDEX idx_exam_sessions_user_completed ON public.exam_sessions USING btree (user_id, completed_at);

CREATE INDEX idx_login_lockouts_ip_username ON public.login_lockouts USING btree (ip_address, username);

CREATE INDEX idx_question_marks_area ON public.question_marks USING btree (study_area_id);

CREATE INDEX idx_question_marks_owner_area ON public.question_marks USING btree (user_id, study_area_id);

CREATE INDEX idx_question_marks_question ON public.question_marks USING btree (question_id);

CREATE INDEX idx_refresh_tokens_token ON public.refresh_tokens USING btree (token);

CREATE INDEX idx_retention_reminders_on ON public.user_retention_settings USING btree (reminder_frequency) WHERE ((reminder_frequency)::text <> 'OFF'::text);

CREATE INDEX idx_session_answers_session ON public.session_answers USING btree (session_id);

CREATE INDEX idx_user_exam_setups_owner ON public.user_exam_setups USING btree (user_id, study_area_id);

CREATE INDEX idx_users_email ON public.users USING btree (email);

CREATE UNIQUE INDEX uq_user_exam_setups_default ON public.user_exam_setups USING btree (user_id, study_area_id) WHERE is_default;

CREATE UNIQUE INDEX users_oauth_subject_idx ON public.users USING btree (oauth_provider, oauth_subject) WHERE (oauth_provider IS NOT NULL);

ALTER TABLE ONLY public.ai_generation_jobs
    ADD CONSTRAINT ai_generation_jobs_study_area_id_fkey FOREIGN KEY (study_area_id) REFERENCES public.study_areas(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_generation_jobs
    ADD CONSTRAINT ai_generation_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_study_area_id_fkey FOREIGN KEY (study_area_id) REFERENCES public.study_areas(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.contact_message_statuses(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_practice_of_session_id_fkey FOREIGN KEY (practice_of_session_id) REFERENCES public.exam_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_study_area_id_fkey FOREIGN KEY (study_area_id) REFERENCES public.study_areas(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT fk_questions_correct_option FOREIGN KEY (correct_option_id) REFERENCES public.options(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.gallery_images
    ADD CONSTRAINT gallery_images_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.question_marks
    ADD CONSTRAINT question_marks_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.question_marks
    ADD CONSTRAINT question_marks_study_area_id_fkey FOREIGN KEY (study_area_id) REFERENCES public.study_areas(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.question_marks
    ADD CONSTRAINT question_marks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_study_area_id_fkey FOREIGN KEY (study_area_id) REFERENCES public.study_areas(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.session_answers
    ADD CONSTRAINT session_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.session_answers
    ADD CONSTRAINT session_answers_selected_option_id_fkey FOREIGN KEY (selected_option_id) REFERENCES public.options(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_answers
    ADD CONSTRAINT session_answers_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.exam_sessions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.study_areas
    ADD CONSTRAINT study_areas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_exam_dates
    ADD CONSTRAINT user_exam_dates_study_area_id_fkey FOREIGN KEY (study_area_id) REFERENCES public.study_areas(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_exam_dates
    ADD CONSTRAINT user_exam_dates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_exam_setups
    ADD CONSTRAINT user_exam_setups_study_area_id_fkey FOREIGN KEY (study_area_id) REFERENCES public.study_areas(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_exam_setups
    ADD CONSTRAINT user_exam_setups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_retention_settings
    ADD CONSTRAINT user_retention_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_study_areas
    ADD CONSTRAINT user_study_areas_study_area_id_fkey FOREIGN KEY (study_area_id) REFERENCES public.study_areas(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_study_areas
    ADD CONSTRAINT user_study_areas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Default site settings. Everything here can be changed in the admin settings page.
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('primary_color', '#6d28d9', 'color', 'Primary Color', 'branding', '#6d28d9', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('secondary_color', '#ffffff', 'color', 'Secondary Color', 'branding', '#ffffff', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('accent_color', '#3b82f6', 'color', 'Accent Color', 'branding', '#3b82f6', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('logo_url', '', 'image_url', 'Logo URL', 'branding', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('favicon_url', '', 'image_url', 'Favicon URL', 'branding', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('phone_primary', '', 'phone', 'Primary Phone', 'contact', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('phone_secondary', '', 'phone', 'Secondary Phone', 'contact', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('email_support', '', 'email', 'Support Email', 'contact', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('email_sales', '', 'email', 'Sales Email', 'contact', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('address', '', 'string', 'Address', 'contact', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('og_image_url', '', 'image_url', 'OG Image URL', 'seo', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('url_linkedin', '', 'url', 'LinkedIn URL', 'social', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('url_instagram', '', 'url', 'Instagram URL', 'social', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('url_facebook', '', 'url', 'Facebook URL', 'social', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('url_twitter', '', 'url', 'Twitter URL', 'social', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('color_success', '#22c55e', 'color', 'Success Color', 'colors', '#22c55e', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('color_warning', '#f59e0b', 'color', 'Warning Color', 'colors', '#f59e0b', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('color_info', '#3b82f6', 'color', 'Info Color', 'colors', '#3b82f6', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('color_danger', '#ef4444', 'color', 'Danger Color', 'colors', '#ef4444', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('email_enabled', 'false', 'boolean', 'Email Enabled', 'notifications', 'false', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('smtp_port', '587', 'string', 'SMTP Port', 'notifications', '587', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('smtp_username', '', 'string', 'SMTP Username', 'notifications', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('smtp_password', '', 'password', 'SMTP Password', 'notifications', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('contact_enabled', 'true', 'boolean', 'Contact Form Enabled', 'contact', 'true', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('contact_email_enabled', 'false', 'boolean', 'Email notifications for Contact Form', 'notifications', 'false', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('google_maps_url', '', 'string', 'Google Maps Embed Link', 'contact', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('register_enabled', 'true', 'boolean', 'User Registration Enabled', 'branding', 'true', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('dark_mode_enabled', 'true', 'boolean', 'Dark Mode Option Enabled', 'branding', 'true', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('confirmation_code_enabled', 'false', 'boolean', 'Email Confirmation Code Required', 'branding', 'false', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('oauth_google_enabled', 'false', 'boolean', 'Google Sign-In Enabled', 'oauth', 'false', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('oauth_microsoft_enabled', 'false', 'boolean', 'Microsoft Sign-In Enabled', 'oauth', 'false', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('primary_color_dark', '#6d28d9', 'color', 'Primary Color (Dark)', 'branding', '#6d28d9', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('secondary_color_dark', '#ffffff', 'color', 'Secondary Color (Dark)', 'branding', '#ffffff', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('accent_color_dark', '#3b82f6', 'color', 'Accent Color (Dark)', 'branding', '#3b82f6', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('default_page_size', '10', 'number', 'Default Page Size', 'branding', '10', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('s3_access_key', '', 'password', 'S3 Access Key', 'branding', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('s3_secret_key', '', 'password', 'S3 Secret Key', 'branding', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('s3_region', '', 'string', 'S3 Region', 'branding', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('s3_bucket', '', 'string', 'S3 Bucket Name', 'branding', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('company_name', 'ExamPrep', 'string', 'Company Name', 'branding', 'ExamPrep', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('meta_title', 'ExamPrep', 'string', 'Meta Title', 'seo', 'ExamPrep', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('tagline', 'Collaborative multiple-choice exam study tool for students.', 'string', 'Tagline', 'branding', 'Collaborative multiple-choice exam study tool for students.', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('meta_description', 'Collaborative multiple-choice exam study tool for students.', 'string', 'Meta Description', 'seo', 'Collaborative multiple-choice exam study tool for students.', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('gallery_enabled', 'true', 'boolean', 'Gallery Enabled', 'branding', 'false', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('ai_generation_enabled', 'false', 'boolean', 'AI Generation Enabled', 'ai', 'false', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('ai_provider', 'anthropic', 'select', 'AI Provider', 'ai', 'anthropic', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('anthropic_api_key', '', 'password', 'Anthropic API Key', 'ai', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('openai_api_key', '', 'password', 'OpenAI API Key', 'ai', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('ai_model', '', 'string', 'Model (empty = provider default)', 'ai', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('ai_monthly_spend_cap_usd', '20', 'number', 'Monthly Spend Cap (USD)', 'ai', '20', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('ai_rate_limit_per_hour', '5', 'number', 'Rate Limit per User (per hour)', 'ai', '5', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('ai_price_input_per_mtok', '', 'number', 'Custom Input Price (USD per MTok)', 'ai', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('email_sender_name', 'ExamPrep', 'string', 'Email Sender Name', 'notifications', 'ExamPrep', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('smtp_host', '', 'string', 'SMTP Host', 'notifications', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('ai_price_output_per_mtok', '', 'number', 'Custom Output Price (USD per MTok)', 'ai', '', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('ai_quota_per_user', '10', 'number', 'Generations per User (every 30 days)', 'ai', '10', now());
INSERT INTO public.site_config (config_key, config_value, config_type, label, config_group, default_value, updated_at) VALUES ('s3_endpoint', '', 'string', 'S3 Endpoint (optional, for S3-compatible servers)', 'branding', '', now());
