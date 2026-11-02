-- The name shown to other people on public study areas. NULL means the first word of the account name.
ALTER TABLE public.users ADD COLUMN public_name character varying(60);
