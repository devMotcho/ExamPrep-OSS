import React from 'react';
import { Link } from 'react-router-dom';
import { useBlogPosts } from '@/components/blog/FeatureGuideLink';
import { useConfig } from '../../lib/config/useConfig';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../hooks/useLocale';
import { Mail, Phone, MapPin, ClipboardCheck, Bug } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation } from 'react-i18next';
import { HOSTED_VERSION_URL } from '@/lib/config/hostedVersion';
 
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);
const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204 013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);
 
export const PublicFooter: React.FC = () => {
  const config = useConfig();
  const { isAuthenticated } = useAuth();
  const { locale } = useLocale();
  const { t } = useTranslation();
 
  const hasBlogPosts = useBlogPosts().length > 0;

  // Social Links List
  const socialLinks = [
    { icon: FacebookIcon, url: config.url_facebook, label: 'Facebook' },
    { icon: TwitterIcon, url: config.url_twitter, label: 'Twitter' },
    { icon: InstagramIcon, url: config.url_instagram, label: 'Instagram' },
    { icon: LinkedInIcon, url: config.url_linkedin, label: 'LinkedIn' },
  ].filter(link => !!link.url); // only render if URL exists
 
  if (isAuthenticated) {
    return (
      <footer className="w-full border-t border-border/20 bg-background/50 backdrop-blur-xs py-4 px-6 shrink-0 text-muted-foreground text-[11px] relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto">
        <div className="flex-1 flex justify-start">
          <span>&copy; {new Date().getFullYear()} {config.company_name}. {t('footer.allRightsReserved', 'Open source under the AGPL-3.0.')}</span>
        </div>
 
        <div className="flex-1 flex items-center justify-end gap-3">
          <Link
            to={`/${locale}/contact?subject=Bug%20Report`}
            className="text-[11px] font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 hover:border-destructive/30 flex items-center gap-1 bg-destructive/5 px-2.5 py-1 min-h-11 md:min-h-0 rounded-md transition-colors"
          >
            <Bug className="w-3 h-3" />
            {t('footer.reportBug', 'Report Bug')}
          </Link>
          {config.dark_mode_enabled !== 'false' && (
            <ThemeToggle />
          )}
        </div>
      </footer>
    );
  }

  return (
    <footer className="w-full border-t border-border/40 bg-card mt-auto shrink-0 pt-16 pb-8 px-6 text-muted-foreground text-xs relative z-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 pb-12 border-b border-border/40">
        
        {/* Brand & Tagline */}
        <div className="md:col-span-4 space-y-4">
          <Link to={`/${locale}`} className="flex items-center gap-3 rounded-lg w-fit min-h-11 group">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
              {config.logo_url ? (
                <img src={config.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <ClipboardCheck className="text-primary w-4.5 h-4.5" />
              )}
            </div>
            <span className="font-bold text-base text-foreground leading-normal">{config.company_name}</span>
          </Link>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
            {config.tagline || t('landing.footer.tagline', 'Multiple-choice exam practice for university students.')}
          </p>
        </div>

        {/* Contact Details (If present) */}
        <div className="md:col-span-4 space-y-3.5">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-widest">{t('footer.companyContact', 'Company Contact')}</h2>
          <ul className="space-y-2 text-xs">
            {config.email_support && (
              <li className="flex items-center gap-2">
                <Mail size={12} className="text-primary shrink-0" />
                <a href={`mailto:${config.email_support}`} className="inline-flex items-center min-h-11 min-w-11 md:min-h-0 hover:text-primary transition-colors truncate">
                  {t('footer.support', 'Support')}: {config.email_support}
                </a>
              </li>
            )}
            {config.email_sales && (
              <li className="flex items-center gap-2">
                <Mail size={12} className="text-primary shrink-0" />
                <a href={`mailto:${config.email_sales}`} className="inline-flex items-center min-h-11 min-w-11 md:min-h-0 hover:text-primary transition-colors truncate">
                  {t('footer.sales', 'Sales')}: {config.email_sales}
                </a>
              </li>
            )}
            {config.phone_primary && (
              <li className="flex items-center gap-2">
                <Phone size={12} className="text-primary shrink-0" />
                <a href={`tel:${config.phone_primary}`} className="inline-flex items-center min-h-11 min-w-11 md:min-h-0 hover:text-primary transition-colors">
                  {config.phone_primary}
                </a>
              </li>
            )}
            {config.address && (
              <li className="flex items-start gap-2">
                <MapPin size={12} className="text-primary mt-0.5 shrink-0" />
                <span className="leading-tight">{config.address}</span>
              </li>
            )}
            {config.contact_enabled !== 'false' && !isAuthenticated && (
              <li className="pt-2 border-t border-border/40 mt-2">
                <Link
                  to={`/${locale}/contact`}
                  className="w-fit text-[11px] sm:text-xs font-semibold text-primary hover:underline flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-2.5 py-1 min-h-11 md:min-h-0 rounded-md transition-colors"
                >
                  {t('footer.sendMessage', 'Send a Message')} <span aria-hidden="true" className="ml-0.5">&rarr;</span>
                </Link>
              </li>
            )}
          </ul>
        </div>

        {/* Quick Platform Navigation Links */}
        <div className="md:col-span-4 space-y-3.5">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-widest">{t('footer.platform', 'Platform')}</h2>
          <ul className="space-y-2 text-xs">
            {hasBlogPosts && (
              <li><Link to={`/${locale}/blog`} className="inline-flex items-center min-h-11 min-w-11 md:min-h-0 hover:text-primary transition-colors">{t('nav.blog', 'Dev blog')}</Link></li>
            )}
            {config.contact_enabled !== 'false' && !isAuthenticated && (
              <li>
                <Link to={`/${locale}/contact`} className="inline-flex items-center min-h-11 min-w-11 md:min-h-0 hover:text-primary transition-colors">
                  {t('nav.contact', 'Contact Us')}
                </Link>
              </li>
            )}
            {config.register_enabled !== 'false' && (
              <li>
                <Link to={`/${locale}/login`} className="inline-flex items-center min-h-11 min-w-11 md:min-h-0 hover:text-primary transition-colors">
                  {t('nav.login', 'Sign In')}
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Footer Bottom copyright and social items */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
        <div className="flex-1 flex justify-start">
          <p className="text-[11px]">&copy; {new Date().getFullYear()} {config.company_name}. {t('footer.allRightsReserved', 'Open source under the AGPL-3.0.')}</p>
        </div>
        
        <div className="flex-1 flex justify-center">
          <a
            href={HOSTED_VERSION_URL}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center min-h-11 md:min-h-0 text-[11px] text-muted-foreground hover:text-foreground hover:underline text-center"
          >
            {t('footer.hostedVersion', 'Prefer not to host it? Use the hosted version')}
          </a>
        </div>

        <div className="flex-1 flex items-center justify-end gap-4 shrink-0">
          <ThemeToggle />
          
          {/* Social Links rendering */}
          {socialLinks.length > 0 && (
            <div className="flex gap-4">
              {socialLinks.map((social, idx) => {
                const SocialIcon = social.icon;
                return (
                  <a
                    key={idx}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="p-2 bg-muted/40 hover:bg-primary/10 hover:text-primary rounded-lg transition-all duration-300"
                  >
                    <SocialIcon className="w-3.5 h-3.5" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};
