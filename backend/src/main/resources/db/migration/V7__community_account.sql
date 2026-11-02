-- Owns the study areas and questions other people still use after their author deletes the account
-- (see AccountDeletionService). It cannot sign in: it is inactive and its password is not a valid hash.
INSERT INTO public.users (id, email, password, role, name, public_name, is_active, is_confirmed)
VALUES ('00000000-0000-0000-0000-00000000c0de', 'community@users.invalid', '!', 'ROLE_SYSTEM',
        'Community', 'Community', false, true)
ON CONFLICT (id) DO NOTHING;
