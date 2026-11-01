import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from '@/features/settings';
import type { ConfigKey } from '@/lib/config/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn, sanitizeHexForColorInput } from '@/lib/utils';
import {
  Palette, Phone, Search, Share2, Save, RotateCcw, Bell, Loader2,
  Mail, Info, Shield, ToggleLeft, BookOpen, Trash, Sparkles, PlugZap
} from 'lucide-react';
import { ImagePickerWidget } from '@/components/admin/ImagePickerWidget';
import { useTranslation } from 'react-i18next';
import { examprepApi, type StudyArea } from '@/api/examprep';
import { aiGenerationApi } from '@/api/aiGeneration';
import { useToast } from '@/context/ToastContext';

// ── Config metadata (static — not state) ─────────────────────────────────────

const configMetadata: Partial<Record<ConfigKey, { label: string; group: string; type: string }>> = {
  company_name:       { label: 'Site Name',        group: 'branding', type: 'string' },
  tagline:            { label: 'Tagline',          group: 'branding', type: 'string' },
  logo_url:           { label: 'Logo',             group: 'branding', type: 'image_url' },
  favicon_url:        { label: 'Favicon',          group: 'branding', type: 'image_url' },
  primary_color:      { label: 'Primary Color',    group: 'colors', type: 'color' },
  primary_color_dark: { label: 'Primary Color (Dark Mode)', group: 'colors', type: 'color' },
  secondary_color:    { label: 'Secondary Color',  group: 'colors', type: 'color' },
  secondary_color_dark: { label: 'Secondary Color (Dark Mode)', group: 'colors', type: 'color' },
  accent_color:       { label: 'Accent Color',     group: 'colors', type: 'color' },
  accent_color_dark:  { label: 'Accent Color (Dark Mode)', group: 'colors', type: 'color' },
  register_enabled:   { label: 'User Registration Enabled', group: 'features', type: 'boolean' },
  confirmation_code_enabled: { label: 'Email Confirmation Code Required', group: 'features', type: 'boolean' },
  dark_mode_enabled:  { label: 'Dark Mode Switcher Enabled', group: 'features', type: 'boolean' },
  multi_lang_enabled: { label: 'Multilingual Language Selection Enabled', group: 'features', type: 'boolean' },
  default_page_size:  { label: 'Default Page Size (Pagination)', group: 'features', type: 'number' },
  color_success:      { label: 'Success Color',    group: 'colors',   type: 'color' },
  color_warning:      { label: 'Warning Color',    group: 'colors',   type: 'color' },
  color_info:         { label: 'Info Color',       group: 'colors',   type: 'color' },
  color_danger:       { label: 'Danger Color',     group: 'colors',   type: 'color' },
  phone_primary:      { label: 'Primary Phone',    group: 'contact',  type: 'phone' },
  phone_secondary:    { label: 'Secondary Phone',  group: 'contact',  type: 'phone' },
  email_support:      { label: 'Support Email',    group: 'contact',  type: 'email' },
  email_sales:        { label: 'Sales Email',      group: 'contact',  type: 'email' },
  address:            { label: 'Address',          group: 'contact',  type: 'string' },
  google_maps_url:    { label: 'Google Maps Link', group: 'contact',  type: 'string' },
  contact_enabled:    { label: 'Contact Form Enabled', group: 'contact', type: 'boolean' },
  meta_title:         { label: 'Meta Title',       group: 'seo',      type: 'string' },
  meta_description:   { label: 'Meta Description', group: 'seo',      type: 'string' },
  og_image_url:       { label: 'OG Image URL',     group: 'seo',      type: 'image_url' },
  url_linkedin:       { label: 'LinkedIn URL',     group: 'social',   type: 'url' },
  url_instagram:      { label: 'Instagram URL',    group: 'social',   type: 'url' },
  url_facebook:       { label: 'Facebook URL',     group: 'social',   type: 'url' },
  url_twitter:        { label: 'Twitter URL',      group: 'social',   type: 'url' },
  
  // Master switches & global parameters
  email_enabled:      { label: 'Email Enabled',      group: 'notifications', type: 'boolean' },
  email_sender_name:  { label: 'Email Sender Name',  group: 'notifications', type: 'string' },
  smtp_host:          { label: 'SMTP Host',          group: 'notifications', type: 'string' },
  smtp_port:          { label: 'SMTP Port',          group: 'notifications', type: 'string' },
  smtp_username:      { label: 'SMTP Username',      group: 'notifications', type: 'string' },
  smtp_password:      { label: 'SMTP Password',      group: 'notifications', type: 'password' },

  // Granular Event Routing Settings
  contact_email_enabled:    { label: 'Contact Email',    group: 'notifications', type: 'boolean' },

  // OAuth2 Social Login
  oauth_google_enabled:    { label: 'Google Sign-In Enabled',    group: 'oauth', type: 'boolean' },
  oauth_microsoft_enabled: { label: 'Microsoft Sign-In Enabled', group: 'oauth', type: 'boolean' },

  // Gallery & S3
  gallery_enabled:        { label: 'Gallery Enabled', group: 'gallery', type: 'boolean' },
  s3_access_key:          { label: 'S3 Access Key', group: 'gallery', type: 'password' },
  s3_secret_key:          { label: 'S3 Secret Key', group: 'gallery', type: 'password' },
  s3_region:              { label: 'S3 Region', group: 'gallery', type: 'string' },
  s3_bucket:              { label: 'S3 Bucket Name', group: 'gallery', type: 'string' },

  // AI question generation
  ai_generation_enabled:    { label: 'Generation Enabled', group: 'ai', type: 'boolean' },
  ai_provider:              { label: 'Provider', group: 'ai', type: 'ai_provider' },
  anthropic_api_key:        { label: 'Anthropic API Key', group: 'ai', type: 'password' },
  openai_api_key:           { label: 'OpenAI API Key', group: 'ai', type: 'password' },
  ai_model:                 { label: 'Model (empty: claude-opus-5-5 / gpt-6-astra)', group: 'ai', type: 'string' },
  ai_quota_per_user:        { label: 'Generations per User', group: 'ai', type: 'number' },
  ai_monthly_spend_cap_usd: { label: 'Monthly Spend Cap (USD)', group: 'ai', type: 'number' },
  ai_rate_limit_per_hour:   { label: 'Rate Limit per User (per Hour)', group: 'ai', type: 'number' },
  ai_price_input_per_mtok:  { label: 'Custom Input Price (USD/MTok, for models without a known price)', group: 'ai', type: 'number' },
  ai_price_output_per_mtok: { label: 'Custom Output Price (USD/MTok, for models without a known price)', group: 'ai', type: 'number' },
};

const groupMeta: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  branding:      { label: 'Branding',        description: 'Site name, tagline, logo and favicon.',                     icon: <Palette size={16} /> },
  colors:        { label: 'App Colors',      description: 'Primary, secondary, accent, and feedback colours.',     icon: <Palette size={16} /> },
  features:      { label: 'Features',        description: 'Enable or disable core application features.', icon: <ToggleLeft size={16} /> },
  contact:       { label: 'Contact',         description: 'Phone numbers, emails, and address displayed on your site.', icon: <Phone size={16} /> },
  seo:           { label: 'SEO',             description: 'Meta tags and Open Graph settings for search engines.',     icon: <Search size={16} /> },
  social:        { label: 'Social',          description: 'Links to your social media profiles.',                      icon: <Share2 size={16} /> },
  notifications: { label: 'Notifications',  description: 'Configure event routing matrix and SMTP Email credentials.', icon: <Bell size={16} /> },
  oauth:         { label: 'Social Login',   description: 'Enable Google and Microsoft OAuth2 sign-in. Requires credentials set in .env — see docs/oauth_setup.md.', icon: <Shield size={16} /> },
  gallery:       { label: 'Gallery & S3',   description: 'Configure AWS S3 integration and toggle the Gallery feature.', icon: <Palette size={16} /> },
  ai:            { label: 'AI Generation',  description: 'Provider, API keys, limits and spend cap for generating questions from PDF.', icon: <Sparkles size={16} /> },
  study_areas:   { label: 'Study Areas',    description: 'Admin backoffice for force deleting public/private study areas.', icon: <BookOpen size={16} /> },
} as const;

const GROUPS = ['branding', 'colors', 'features', 'contact', 'seo', 'social', 'notifications', 'oauth', 'gallery', 'ai', 'study_areas'] as const;

// ── Sub-components ────────────────────────────────────────────────────────────

interface ConfigInputProps {
  configKey: ConfigKey;
  type: string;
  value: string;
  onChange: (key: ConfigKey, value: string) => void;
}

const ConfigInput: React.FC<ConfigInputProps> = ({ configKey, type, value, onChange }) => {
  const { t } = useTranslation();
  const label = t(`settings.fields.${configKey}`, configMetadata[configKey]?.label ?? '');
  const placeholder = t('settings.enterValue', { defaultValue: 'Enter {{label}}', label: label.toLowerCase() });
  if (type === 'color') {
    return (
      <div className="flex gap-2 items-center">
        <div className="relative">
          <input
            type="color"
            value={sanitizeHexForColorInput(value)}
            onChange={(e) => onChange(configKey, e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
          <div className="w-11 h-11 md:w-9 md:h-9 rounded-md border border-border shrink-0" style={{ backgroundColor: value || '#000000' }} />
        </div>
        <Input type="text" value={value} onChange={(e) => onChange(configKey, e.target.value)} className="flex-1 font-mono text-sm uppercase" placeholder="#000000" />
      </div>
    );
  }
  if (type === 'boolean') {
    return (
      <Switch checked={value === 'true'} aria-label={label} onCheckedChange={(c) => onChange(configKey, c ? 'true' : 'false')} />
    );
  }
  if (type === 'image_url') {
    return (
      <ImagePickerWidget
        value={value}
        onChange={(v) => onChange(configKey, v)}
        placeholder={placeholder}
      />
    );
  }
  if (type === 'ai_provider') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(configKey, e.target.value)}
        aria-label={label}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="anthropic">Claude (Anthropic)</option>
        <option value="openai">OpenAI (Codex)</option>
      </select>
    );
  }
  return (
    <Input
      type={type === 'email' ? 'email' : type === 'url' ? 'url' : type === 'phone' ? 'tel' : type === 'password' ? 'password' : type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(configKey, e.target.value)}
      onFocus={type === 'password' ? (e) => e.target.select() : undefined}
      autoComplete={type === 'password' ? 'new-password' : undefined}
      className="w-full bg-background"
      placeholder={placeholder}
    />
  );
};

// ── Page shell ────────────────────────────────────────────────────────────────

export const Settings: React.FC = () => {
  const { formData, unsavedGroups, isSaving, loadingSettings, handleChange, handleReset, handleSaveGroup } = useSettings();
  const [activeGroup, setActiveGroup] = useState<string>('branding');
  const navRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!navRef.current) return;
    const activeEl = navRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeGroup]);

  if (loadingSettings) {
    return (
      <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-7xl flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  const activeGroupMeta = groupMeta[activeGroup];
  const activeKeys = (Object.keys(configMetadata) as ConfigKey[]).filter(
    (k) => configMetadata[k]?.group === activeGroup
  );

  // Event metadata for notifications routing matrix
  const notificationEvents = [
    {
      type: 'contact',
      label: t('settings.events.contactLabel', 'Contact Form Submissions'),
      desc: t('settings.events.contactDesc', 'Triggered when visitors submit inquiries or request support via the contact page.'),
    },
  ];

  return (
    <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-7xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/65 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-border/50 shadow-sm bg-gradient-to-br from-card to-primary/[0.01]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{t('settings.title', 'Settings')}</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1 leading-relaxed max-w-3xl">
            {t('settings.description', 'Configure system routing parameters, update semantic color variables, configure SEO metadata, social accounts, and establish secure SMTP/Telegram configurations.')}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row border border-border/50 rounded-2xl overflow-hidden bg-card/65 backdrop-blur-md shadow-md md:h-[680px]">
        {/* Sidebar */}
        <nav ref={navRef} className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border/40 bg-muted/10 py-2 md:py-4 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible whitespace-nowrap md:whitespace-normal scrollbar-none">
          <p className="hidden md:block text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-4 py-2 mb-1">{t('settings.configuration', 'Configuration')}</p>
          {GROUPS.map((group) => {
            const meta = groupMeta[group];
            const isActive = activeGroup === group;
            const isDirty = unsavedGroups.has(group);
            return (
              <button
                key={group}
                onClick={() => setActiveGroup(group)}
                data-active={isActive}
                className={cn(
                  'w-auto md:w-full flex items-center gap-2.5 px-4 min-h-11 py-2 text-sm transition-all border-b-2 md:border-b-0 md:border-l-2 shrink-0',
                  isActive 
                    ? 'bg-card/90 text-foreground border-b-primary md:border-b-transparent md:border-l-primary font-bold shadow-sm' 
                    : 'border-b-transparent md:border-l-transparent text-muted-foreground hover:bg-card/30 hover:text-foreground'
                )}
              >
                <span className={cn('shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')}>{meta.icon}</span>
                <span>{t(`settings.groups.${group}`, meta.label)}</span>
                {isDirty && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-destructive shrink-0 animate-pulse" />}
              </button>
            );
          })}
        </nav>

        {/* Main content */}
        <div className="flex flex-col flex-1 md:overflow-hidden">
          <div className="flex items-start md:items-center justify-between gap-4 px-4 md:px-6 py-4 border-b border-border/40 bg-card/40">
            <div className="space-y-0.5">
              <h2 className="text-base font-black tracking-tight text-foreground">{t(`settings.groups.${activeGroup}`, activeGroupMeta.label)}</h2>
            </div>
            {unsavedGroups.has(activeGroup) && (
              <Badge variant="destructive" className="text-[11px] uppercase font-bold shrink-0 animate-pulse mt-0.5 md:mt-0">{t('settings.unsavedChanges', 'Unsaved changes')}</Badge>
            )}
          </div>

          <div className="flex-1 md:overflow-y-auto px-4 md:px-6 py-5 bg-muted/5">
            {activeGroup === 'study_areas' ? (
              <AdminStudyAreasView />
            ) : activeGroup === 'notifications' ? (
              // ── Notifications UI ──
              <div className="space-y-8">
                
                {/* 1. Notification Event Routing Matrix */}
                <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 md:p-5 shadow-sm space-y-4 hover:border-primary/20 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={16} className="text-primary shrink-0" />
                    <h3 className="text-sm font-bold text-foreground">{t('settings.notificationEventMatrix', 'Notification Event Matrix')}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
                    {t('settings.notificationMatrixDesc', 'Select which communication channels will receive alerts for specific system occurrences. Enabling a channel inside a row will route that event directly to its configured administrators.')}
                  </p>

                  <div className="overflow-x-auto border border-border/50 rounded-2xl mt-4">
                    <table className="w-full text-left border-collapse min-w-[500px] md:min-w-0">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border/40 text-[11px] uppercase font-black tracking-wider text-muted-foreground">
                          <th className="p-4 w-[65%] min-w-[150px]">{t('settings.eventHeader', 'System Event / Trigger')}</th>
                          <th className="p-4 text-center w-[35%]">
                            <div className="flex items-center justify-center gap-1.5">
                              <Mail size={13} className="text-primary" /> {t('settings.email', 'Email')}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-sm">
                        {notificationEvents.map((event) => {
                          const emailKey = `${event.type}_email_enabled` as ConfigKey;

                          return (
                            <tr key={event.type} className="hover:bg-muted/10 transition-colors">
                              <td className="p-4 space-y-1">
                                <span className="font-bold text-foreground block">{event.label}</span>
                                <span className="text-xs text-muted-foreground leading-relaxed block">{event.desc}</span>
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center">
                                  <Switch 
                                    checked={formData[emailKey] === 'true'} 
                                    onCheckedChange={(c) => handleChange(emailKey, c ? 'true' : 'false', 'notifications')} 
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Separator className="bg-border/60" />

                {/* 2. Channels Credentials & Parameters */}
                <h3 className="text-sm font-bold text-foreground px-1">{t('settings.globalCredentials', 'Global Channel Credentials')}</h3>
                
                <div className="grid grid-cols-1 gap-6">
                  
                  {/* Email & SMTP Credentials */}
                  <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 md:p-5 shadow-sm space-y-4 hover:border-primary/20 transition-all duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-primary shrink-0" />
                        <h4 className="text-sm font-bold text-foreground">{t('settings.smtpCredentials', 'Email (SMTP) Credentials')}</h4>
                      </div>
                      <div className="flex items-center justify-between sm:justify-start gap-3">
                        <span className="text-xs text-muted-foreground font-medium">{t('settings.masterSwitch', 'Channel Master Switch')}</span>
                        <Switch 
                          checked={formData.email_enabled === 'true'} 
                          onCheckedChange={(c) => handleChange('email_enabled', c ? 'true' : 'false', 'notifications')} 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-semibold">{t('settings.fields.email_sender_name', 'Email Sender Name')}</Label>
                        <ConfigInput configKey="email_sender_name" type="string" value={formData.email_sender_name ?? ''} onChange={(k, v) => handleChange(k, v, 'notifications')} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-semibold">{t('settings.fields.smtp_host', 'SMTP Host')}</Label>
                        <ConfigInput configKey="smtp_host" type="string" value={formData.smtp_host ?? ''} onChange={(k, v) => handleChange(k, v, 'notifications')} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-semibold">{t('settings.fields.smtp_port', 'SMTP Port')}</Label>
                        <ConfigInput configKey="smtp_port" type="string" value={formData.smtp_port ?? ''} onChange={(k, v) => handleChange(k, v, 'notifications')} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-semibold">{t('settings.fields.smtp_username', 'SMTP Username')}</Label>
                        <ConfigInput configKey="smtp_username" type="string" value={formData.smtp_username ?? ''} onChange={(k, v) => handleChange(k, v, 'notifications')} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-semibold">{t('settings.fields.smtp_password', 'SMTP Password')}</Label>
                        <ConfigInput configKey="smtp_password" type="password" value={formData.smtp_password ?? ''} onChange={(k, v) => handleChange(k, v, 'notifications')} />
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              // ── STANDARD SIMPLE CONFIGS UI (BRANDING, COLORS, SEO, ETC.) ──
              <div className="space-y-3.5">
                {activeKeys.map((key) => {
                  const meta = configMetadata[key];
                  if (!meta) return null;
                  return (
                    <div key={key} className="grid grid-cols-1 md:grid-cols-[200px_1fr] items-start md:items-center gap-2 md:gap-4 p-4 rounded-2xl border border-border/50 hover:border-primary/25 bg-card/40 backdrop-blur-sm shadow-sm transition-all duration-200">
                      <Label className="text-sm font-semibold text-muted-foreground leading-snug">{t(`settings.fields.${key}`, meta.label)}</Label>
                      <div>
                        <ConfigInput
                          configKey={key}
                          type={meta.type}
                          value={formData[key] ?? ''}
                          onChange={(k, v) => handleChange(k, v, meta.group)}
                        />
                      </div>
                    </div>
                  );
                })}
                {activeGroup === 'ai' && <AiConnectionPanel hasUnsavedChanges={unsavedGroups.has('ai')} />}
              </div>
            )}
          </div>

          {/* Footer Save / Reset Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 px-4 md:px-6 py-4 border-t border-border bg-muted/20">
            <Button variant="ghost" size="sm" onClick={() => handleReset(activeGroup)} disabled={!unsavedGroups.has(activeGroup)} className="gap-1.5 font-medium text-xs">
              <RotateCcw size={13} /> {t('settings.reset', 'Reset changes')}
            </Button>
            <Button size="sm" onClick={() => handleSaveGroup(activeGroup, activeKeys)} disabled={!unsavedGroups.has(activeGroup) || isSaving} className="gap-1.5 font-semibold text-xs bg-primary text-primary-foreground">
              <Save size={13} /> {isSaving ? t('settings.saving', 'Saving changes…') : t('settings.saveGroup', 'Save changes')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AiConnectionPanel: React.FC<{ hasUnsavedChanges: boolean }> = ({ hasUnsavedChanges }) => {
  const { t } = useTranslation();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [usage, setUsage] = useState<{ spentThisMonthUsd: number; capUsd: number } | null>(null);

  useEffect(() => {
    aiGenerationApi.getUsage().then(setUsage).catch(() => setUsage(null));
  }, []);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await aiGenerationApi.testConnection();
      setResult(res.ok
        ? { ok: true, text: t('settings.ai.testSuccess', 'Connection works: {{provider}}, model {{model}}.', { provider: res.provider, model: res.model }) }
        : { ok: false, text: res.code ? t(`aiGen.errors.${res.code}`, res.message ?? '') : (res.message ?? '') });
    } catch {
      setResult({ ok: false, text: t('settings.ai.testFailed', 'Could not run the test.') });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-2xl border border-border/50 bg-card/40 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={runTest} disabled={testing || hasUnsavedChanges} className="gap-1.5 text-xs font-semibold">
          {testing ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
          {t('settings.ai.testConnection', 'Test connection')}
        </Button>
        {hasUnsavedChanges && <span className="text-xs text-muted-foreground">{t('settings.ai.saveBeforeTest', 'Save your changes before testing.')}</span>}
        {usage && (
          <span className="text-xs text-muted-foreground ml-auto">
            {t('settings.ai.usage', 'This month: {{spent}} of {{cap}} USD', { spent: Number(usage.spentThisMonthUsd).toFixed(2), cap: Number(usage.capUsd).toFixed(2) })}
          </span>
        )}
      </div>
      {result && (
        <p role="status" className={cn('text-xs font-semibold', result.ok ? 'text-primary' : 'text-destructive')}>{result.text}</p>
      )}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t('settings.ai.keysNote', 'Saved keys are encrypted and never shown again. Leave the masked value to keep a key, or clear the field to remove it. Requires AI_SETTINGS_ENCRYPTION_KEY on the server.')}
      </p>
    </div>
  );
};

const AdminStudyAreasView: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [studyAreas, setStudyAreas] = useState<StudyArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStudyAreas = async () => {
    try {
      const data = await examprepApi.adminListStudyAreas();
      setStudyAreas(data);
    } catch {
      toast({ type: 'error', message: t('settings.adminAreas.loadFailed', 'Failed to load study areas for admin.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudyAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('settings.adminAreas.confirmDelete', 'Are you sure you want to force-delete this study area? All associated questions, options, and student progress/answers will be permanently lost!'))) {
      return;
    }
    setDeletingId(id);
    try {
      await examprepApi.adminDeleteStudyArea(id);
      toast({ type: 'success', message: t('settings.adminAreas.deleted', 'Study area force-deleted successfully!') });
      fetchStudyAreas();
    } catch {
      toast({ type: 'error', message: t('settings.adminAreas.deleteFailed', 'Failed to delete study area.') });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-muted/40 rounded-xl" />
        <div className="h-32 bg-muted/20 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/50 bg-card/45 backdrop-blur-sm p-4 md:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4 pb-2 border-b border-border/40">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-foreground">{t('settings.adminAreas.title', 'Global Study Areas')}</h3>
            <p className="text-xs text-muted-foreground leading-normal">
              {t('settings.adminAreas.desc', 'Manage and moderate all study areas across the platform. You have the authority to delete any public or private area.')}
            </p>
          </div>
        </div>

        {studyAreas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs italic">
            {t('settings.adminAreas.empty', 'No study areas have been created on the platform yet.')}
          </div>
        ) : (
          <div className="overflow-x-auto border border-border/50 rounded-2xl">
            <table className="w-full min-w-[640px] text-left border-collapse text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border/40 text-[11px] uppercase font-black tracking-wider text-muted-foreground">
                  <th className="p-4">{t('settings.adminAreas.colTitle', 'Title')}</th>
                  <th className="p-4">{t('settings.adminAreas.colVisibility', 'Visibility')}</th>
                  <th className="p-4">{t('settings.adminAreas.colCreatedBy', 'Created By')}</th>
                  <th className="p-4 text-center">{t('settings.adminAreas.colQuestions', 'Questions')}</th>
                  <th className="p-4">{t('settings.adminAreas.colCreated', 'Created Date')}</th>
                  <th className="p-4 text-right">{t('settings.adminAreas.colActions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 bg-card/10">
                {studyAreas.map((area) => (
                  <tr key={area.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4 font-bold text-foreground max-w-[200px] truncate">{area.title}</td>
                    <td className="p-4">
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-black uppercase px-2 h-5 rounded-md ${
                          area.visibility === 'PRIVATE'
                            ? 'border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/5'
                            : 'border-primary/30 text-primary bg-primary/5'
                        }`}
                      >
                        {t(`settings.adminAreas.visibility.${area.visibility}`, area.visibility)}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">{area.createdBy}</td>
                    <td className="p-4 text-center font-semibold text-foreground">{area.questionCount}</td>
                    <td className="p-4 text-muted-foreground text-xs">
                      {new Date(area.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === area.id}
                        onClick={() => handleDelete(area.id)}
                        className="h-8 rounded-lg text-xs font-semibold px-2 hover:bg-destructive/10 text-destructive"
                      >
                        <Trash className="h-3.5 w-3.5 mr-1" />
                        {deletingId === area.id ? t('settings.adminAreas.deleting', 'Deleting...') : t('settings.adminAreas.delete', 'Delete')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};