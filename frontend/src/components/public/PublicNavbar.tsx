import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useConfig } from '../../lib/config/useConfig';
import { useLocale } from '../../hooks/useLocale';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ClipboardCheck, Menu, X, ArrowRight, Mail, Newspaper } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useBlogPosts } from '@/components/blog/FeatureGuideLink';

import { useTranslation } from 'react-i18next';

interface PublicNavbarProps {
  isSticky?: boolean;
  onMenuToggle?: () => void;
  isSidebarOpen?: boolean;
  userProfileNode?: React.ReactNode;
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({ isSticky = true, onMenuToggle, isSidebarOpen, userProfileNode }) => {
  const config = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useLocale();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hasBlogPosts = useBlogPosts().length > 0;
  const isBlogPage = location.pathname.includes('/blog');

  const isLoginPage = location.pathname.endsWith('/login');
  const isRegisterPage = location.pathname.endsWith('/register');

  const handleContactClick = () => {
    setMobileMenuOpen(false);
    navigate(`/${locale}/contact`);
  };

  return (
    <header className={cn(
      isSticky ? "sticky" : "relative",
      "top-[calc(var(--sat)+0.5rem)] sm:top-[calc(var(--sat)+1rem)] mt-2 sm:mt-4 z-50 max-w-7xl mx-auto w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] bg-card/90 backdrop-blur-md border border-border/50 rounded-2xl shadow-lg hover:border-primary/10 transition-all duration-300"
    )}>
      <div className="pl-3 pr-2 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        
        <div className="flex items-center gap-1 sm:gap-3 min-w-0">
          {/* Menu Toggle for Authenticated Users */}
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="relative p-2 -ml-2 w-11 h-11 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors overflow-hidden"
              aria-label={isSidebarOpen ? t('landing.nav.closeMenu', 'Close menu') : t('landing.nav.openMenu', 'Open menu')}
              aria-expanded={isSidebarOpen}
            >
              <Menu 
                size={20} 
                className={cn(
                  "absolute transition-all duration-300 ease-in-out",
                  isSidebarOpen ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
                )} 
              />
              <X 
                size={20} 
                className={cn(
                  "absolute transition-all duration-300 ease-in-out",
                  isSidebarOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"
                )} 
              />
            </button>
          )}

          {/* Brand/Logo */}
          <Link to={`/${locale}`} className="flex items-center gap-2 sm:gap-3 rounded-xl group min-w-0 min-h-11">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center overflow-hidden shrink-0 shadow-md group-hover:scale-105 transition-transform duration-200">
              {config.logo_url ? (
                <img src={config.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <ClipboardCheck className="text-primary-foreground w-5 h-5" />
              )}
            </div>
            <span className="font-extrabold text-base sm:text-lg truncate tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80 group-hover:text-primary transition-colors">
              {config.company_name}
            </span>
          </Link>
        </div>

        {userProfileNode ? (
          <div className="flex items-center gap-2">
            {userProfileNode}
          </div>
        ) : (
          <>
            {/* Desktop right-side actions */}
            <div className="hidden md:flex items-center gap-3">
              {hasBlogPosts && (
                <Button
                  variant="ghost"
                  className={cn(
                    'text-xs font-bold h-9 px-3.5 rounded-xl flex items-center gap-1.5',
                    isBlogPage ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  onClick={() => navigate(`/${locale}/blog`)}
                >
                  <Newspaper className="w-3.5 h-3.5" />
                  {t('blog.eyebrow', 'Dev blog')}
                </Button>
              )}
              {/* Contact — sits just left of language toggler */}
              {config.contact_enabled !== 'false' && (
                <Button
                  variant="ghost"
                  className={cn(
                    'text-xs font-bold h-9 px-3.5 rounded-xl flex items-center gap-1.5',
                    location.pathname.endsWith('/contact')
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  onClick={handleContactClick}
                >
                  <Mail className="w-3.5 h-3.5" />
                  {t('nav.contact')}
                </Button>
              )}
              <LanguageSwitcher />
              <ThemeToggle />
              {config.register_enabled !== 'false' && !isLoginPage && (
                <Button
                  variant="ghost"
                  className="text-xs font-bold h-9 px-3.5 rounded-xl hover:bg-muted"
                  onClick={() => navigate(`/${locale}/login`)}
                >
                  {t('nav.login')}
                </Button>
              )}
              {config.register_enabled !== 'false' && !isRegisterPage && (
                <Button
                  className="text-xs font-bold h-9 px-4 rounded-xl bg-gradient-to-r from-primary to-primary/95 text-primary-foreground shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                  onClick={() => navigate(`/${locale}/register`)}
                >
                  {t('nav.register')} <ArrowRight className="w-3.5 h-3.5 ml-1.5 shrink-0" />
                </Button>
              )}
            </div>

            {/* Mobile Menu */}
            <div className="flex items-center gap-1 md:hidden">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="w-11 h-11 flex items-center justify-center text-foreground hover:bg-muted/80 rounded-lg transition-colors"
                aria-label={mobileMenuOpen ? t('landing.nav.closeMenu', 'Close menu') : t('landing.nav.openMenu', 'Open menu')}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && !userProfileNode && (
        <div className="md:hidden absolute top-[64px] left-0 w-full bg-card/95 backdrop-blur-md border border-border/50 shadow-xl rounded-2xl p-5 animate-in slide-in-from-top duration-200 z-50">
          <div className="flex flex-col space-y-3.5">
            {hasBlogPosts && (
              <button
                onClick={() => { setMobileMenuOpen(false); navigate(`/${locale}/blog`); }}
                className={`text-left px-3.5 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2.5 ${
                  isBlogPage ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Newspaper className="w-4 h-4" />
                <span>{t('blog.eyebrow', 'Dev blog')}</span>
              </button>
            )}
            {/* Contact */}
            {config.contact_enabled !== 'false' && (
              <button
                onClick={handleContactClick}
                className={`text-left px-3.5 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2.5 ${
                  location.pathname.endsWith('/contact')
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>{t('nav.contact')}</span>
              </button>
            )}
            {/* Auth buttons */}
            {config.register_enabled !== 'false' && (
              <div className={cn(
                'pt-3 border-t border-border/40 gap-3 flex',
                (!isRegisterPage && !isLoginPage) ? 'flex-row [&>*]:flex-1' : 'flex-col'
              )}>
                {!isLoginPage && (
                  <Button
                    variant="outline"
                    className="w-full text-xs font-bold h-10 rounded-xl"
                    onClick={() => { setMobileMenuOpen(false); navigate(`/${locale}/login`); }}
                  >
                    {t('nav.login')}
                  </Button>
                )}
                {!isRegisterPage && (
                  <Button
                    className="w-full text-xs font-bold h-10 rounded-xl bg-primary text-primary-foreground"
                    onClick={() => { setMobileMenuOpen(false); navigate(`/${locale}/register`); }}
                  >
                    {t('nav.register')}
                  </Button>
                )}
              </div>
            )}
            {/* Theme + Language */}
            {config.dark_mode_enabled !== 'false' && (
              <div className="pt-3 border-t border-border/40 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-3.5">{t('nav.theme', 'Theme')}</p>
                <div className="flex items-center justify-between gap-3 px-3.5">
                  <div className="flex-1">
                    <ThemeToggle variant="sidebar-expanded" className="w-full" />
                  </div>
                  <LanguageSwitcher />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
