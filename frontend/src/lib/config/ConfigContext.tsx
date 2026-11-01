import { createContext, useEffect, useState, ReactNode } from 'react';
import { SiteConfig } from './types';
import { defaultConfig } from './defaults';
import { axiosInstance } from '../../api/axiosInstance';
import { hexToHSL, getContrastForegroundHSL } from '../utils';
import { ensureDarkModeContrast } from './contrast';
import logoUrl from '../../assets/logo.svg';
import faviconUrl from '../../assets/favicon.svg';
import { ProfessionalLoader } from '../../components/ui/ProfessionalLoader';

export const ConfigContext = createContext<SiteConfig>(defaultConfig);

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<SiteConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  function applyConfig(conf: SiteConfig) {
    const root = document.documentElement;

    let styleEl = document.getElementById('dynamic-theme-config') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-theme-config';
      document.head.appendChild(styleEl);
    }

    const primaryDark = ensureDarkModeContrast(conf.primary_color_dark || conf.primary_color);
    const secondaryDark = conf.secondary_color_dark || conf.secondary_color;
    const accentDark = conf.accent_color_dark || conf.accent_color;

    styleEl.textContent = `
      :root {
        --color-primary: ${hexToHSL(conf.primary_color)};
        --primary-foreground: ${getContrastForegroundHSL(conf.primary_color)};
        --color-secondary: ${hexToHSL(conf.secondary_color)};
        --secondary-foreground: ${getContrastForegroundHSL(conf.secondary_color)};
        --color-accent: ${hexToHSL(conf.accent_color)};
        --accent-foreground: ${getContrastForegroundHSL(conf.accent_color)};
        --color-success: ${hexToHSL(conf.color_success)};
        --success-foreground: ${getContrastForegroundHSL(conf.color_success)};
        --color-warning: ${hexToHSL(conf.color_warning)};
        --warning-foreground: ${getContrastForegroundHSL(conf.color_warning)};
        --color-info: ${hexToHSL(conf.color_info)};
        --info-foreground: ${getContrastForegroundHSL(conf.color_info)};
        --color-danger: ${hexToHSL(conf.color_danger)};
        --danger-foreground: ${getContrastForegroundHSL(conf.color_danger)};
      }
      .dark {
        --color-primary: ${hexToHSL(primaryDark)};
        --primary-foreground: ${getContrastForegroundHSL(primaryDark)};
        --color-secondary: ${hexToHSL(secondaryDark)};
        --secondary-foreground: ${getContrastForegroundHSL(secondaryDark)};
        --color-accent: ${hexToHSL(accentDark)};
        --accent-foreground: ${getContrastForegroundHSL(accentDark)};
      }
    `;

    // Remove legacy inline variables if present so they don't override the style tag
    const legacyVars = [
      '--color-primary', '--primary-foreground',
      '--color-secondary', '--secondary-foreground',
      '--color-accent', '--accent-foreground',
      '--color-success', '--success-foreground',
      '--color-warning', '--warning-foreground',
      '--color-info', '--info-foreground',
      '--color-danger', '--danger-foreground'
    ];
    legacyVars.forEach(v => root.style.removeProperty(v));

    // Title, description and Open Graph tags are owned by components/public/SEO.tsx.

    // Favicon
    if (conf.favicon_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = conf.favicon_url;
    }
  }

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const urlLang = window.location.pathname.split('/')[1];
        const currentLang = urlLang === 'pt' || urlLang === 'en' ? urlLang : localStorage.getItem('locale') || 'pt';
        const response = await axiosInstance.get<SiteConfig>(`/api/config/public?lang=${currentLang}`);
        const fetchedConfig = { 
          ...defaultConfig, 
          ...response.data,
          company_name: response.data.company_name || defaultConfig.company_name,
          logo_url: response.data.logo_url || logoUrl,
          favicon_url: response.data.favicon_url || faviconUrl,
        };
        setConfig(fetchedConfig);
        applyConfig(fetchedConfig);
      } catch (error) {
        console.error('Failed to load site config. Using defaults.', error);
        const fallbackConfig = {
          ...defaultConfig,
        };
        setConfig(fallbackConfig);
        applyConfig(fallbackConfig);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();

    // Listen for custom event updates to avoid freezing page refreshes
    const handleConfigUpdate = () => {
      fetchConfig();
    };
    window.addEventListener('app-config-updated', handleConfigUpdate);
    window.addEventListener('online', handleConfigUpdate);
    return () => {
      window.removeEventListener('online', handleConfigUpdate);
      window.removeEventListener('app-config-updated', handleConfigUpdate);
    };
  }, []);

  if (loading) {
    return <ProfessionalLoader />;
  }

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
};
