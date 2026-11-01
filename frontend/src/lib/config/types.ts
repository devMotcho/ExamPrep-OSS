export interface SiteConfig {
  // Branding
  primary_color: string;
  primary_color_dark: string;
  secondary_color: string;
  secondary_color_dark: string;
  accent_color: string;
  accent_color_dark: string;
  logo_url: string;
  favicon_url: string;
  company_name: string;
  tagline: string;

  // Semantic Colors
  color_success: string;
  color_warning: string;
  color_info: string;
  color_danger: string;

  // Contact
  phone_primary: string;
  phone_secondary: string;
  email_support: string;
  email_sales: string;
  address: string;
  google_maps_url: string;
  contact_enabled: string;
  register_enabled: string;
  confirmation_code_enabled: string;
  oauth_google_enabled: string;
  oauth_microsoft_enabled: string;

  // SEO
  meta_title: string;
  meta_description: string;
  og_image_url: string;

  // Social
  url_linkedin: string;
  url_instagram: string;
  url_facebook: string;
  url_twitter: string;

  // Notifications Settings
  email_enabled: string;
  email_sender_name: string;
  smtp_host: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;

  // Granular Event Routing Settings
  contact_email_enabled: string;
  dark_mode_enabled: string;
  default_page_size: string;

  // Gallery & S3 Storage
  gallery_enabled: string;
  s3_access_key: string;
  s3_secret_key: string;
  s3_region: string;
  s3_bucket: string;
  multi_lang_enabled: string;

  // AI question generation (developer settings only, excluded from the public config)
  ai_generation_enabled: string;
  ai_provider: string;
  anthropic_api_key: string;
  openai_api_key: string;
  ai_model: string;
  ai_quota_per_user: string;
  ai_monthly_spend_cap_usd: string;
  ai_rate_limit_per_hour: string;
  ai_price_input_per_mtok: string;
  ai_price_output_per_mtok: string;
}

export type ConfigKey = keyof SiteConfig;
