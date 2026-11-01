import { SiteConfig } from './types';
import logoUrl from '../../assets/logo.svg';
import faviconUrl from '../../assets/favicon.svg';

export const defaultConfig: SiteConfig = {
  // eslint-disable-next-line no-restricted-syntax
  primary_color: '#000000',
  // eslint-disable-next-line no-restricted-syntax
  primary_color_dark: '#000000',
  // eslint-disable-next-line no-restricted-syntax
  secondary_color: '#ffffff',
  // eslint-disable-next-line no-restricted-syntax
  secondary_color_dark: '#ffffff',
  // eslint-disable-next-line no-restricted-syntax
  accent_color: '#3b82f6',
  // eslint-disable-next-line no-restricted-syntax
  accent_color_dark: '#3b82f6',
  // eslint-disable-next-line no-restricted-syntax
  color_success: '#22c55e',
  // eslint-disable-next-line no-restricted-syntax
  color_warning: '#f59e0b',
  // eslint-disable-next-line no-restricted-syntax
  color_info: '#3b82f6',
  // eslint-disable-next-line no-restricted-syntax
  color_danger: '#ef4444',
  logo_url: logoUrl,
  favicon_url: faviconUrl,
  company_name: 'ExamPrep',
  tagline: '',
  phone_primary: '',
  phone_secondary: '',
  email_support: '',
  email_sales: '',
  address: '',
  google_maps_url: '',
  contact_enabled: 'true',
  register_enabled: 'true',
  confirmation_code_enabled: 'false',
  oauth_google_enabled: 'false',
  oauth_microsoft_enabled: 'false',
  meta_title: '',
  meta_description: '',
  og_image_url: '',
  url_linkedin: '',
  url_instagram: '',
  url_facebook: '',
  url_twitter: '',
  email_enabled: 'false',
  email_sender_name: 'ExamPrep',
  smtp_host: '',
  smtp_port: '587',
  smtp_username: '',
  smtp_password: '',

  // Granular Event Routing Settings Defaults
  contact_email_enabled: 'false',
  dark_mode_enabled: 'true',
  default_page_size: '10',

  gallery_enabled: 'true',
  s3_access_key: '',
  s3_secret_key: '',
  s3_region: '',
  s3_bucket: '',
  multi_lang_enabled: 'true',
  ai_generation_enabled: 'false',
  ai_provider: 'anthropic',
  anthropic_api_key: '',
  openai_api_key: '',
  ai_model: '',
  ai_quota_per_user: '10',
  ai_monthly_spend_cap_usd: '20',
  ai_rate_limit_per_hour: '5',
  ai_price_input_per_mtok: '',
  ai_price_output_per_mtok: '',
};
