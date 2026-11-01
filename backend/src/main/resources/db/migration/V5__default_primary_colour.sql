-- The default primary colour now matches the logo. An instance that chose its own colour keeps it.
UPDATE public.site_config
   SET config_value = '#0f766e'
 WHERE config_key IN ('primary_color', 'primary_color_dark')
   AND lower(config_value) = '#6d28d9';

UPDATE public.site_config
   SET default_value = '#0f766e'
 WHERE config_key IN ('primary_color', 'primary_color_dark');
