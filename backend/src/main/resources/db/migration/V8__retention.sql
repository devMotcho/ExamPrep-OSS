-- When an inactive account was told it will be deleted; see InactiveAccountJob.
ALTER TABLE public.users ADD COLUMN inactivity_warned_at timestamp with time zone;

-- Failed logins keep only a hash of the attempted email (as LoginLockoutService.hashUsername), and contact
-- messages no IP address.
UPDATE public.login_lockouts
   SET username = 'sha256:' || encode(sha256(convert_to(lower(trim(username)), 'UTF8')), 'hex')
 WHERE username NOT LIKE 'sha256:%';
UPDATE public.contact_messages SET ip_address = NULL WHERE ip_address IS NOT NULL;
