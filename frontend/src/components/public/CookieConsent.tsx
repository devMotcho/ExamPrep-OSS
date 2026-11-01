import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { readConsent, saveConsent, type ConsentChoice } from '@/lib/telemetryConsent';

export const CookieConsent: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!readConsent()) {
      setIsVisible(true);
    }
  }, []);

  const choose = (choice: ConsentChoice) => {
    saveConsent(choice);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-[var(--bottom-bar-h,0px)] left-0 right-0 z-50 p-3 sm:p-6 pointer-events-none">
      <div className="max-w-5xl mx-auto bg-card/95 backdrop-blur-md border border-border/50 shadow-2xl rounded-2xl p-4 sm:p-6 pointer-events-auto flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <span aria-hidden="true" className="text-xl">🍪</span> {t('cookies.title', 'Cookies and local storage')}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {t('cookies.description', 'We use session cookies to keep you signed in. With your permission, we also store a device identifier in your browser to count visits, and forget it after 90 days without a visit. Nothing is used for advertising or shared with ad networks.')}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
          <button
            onClick={() => choose('essential')}
            className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-bold border border-border bg-card hover:bg-muted text-foreground transition-all duration-300 whitespace-nowrap"
          >
            {t('cookies.essentialOnly', 'Essential only')}
          </button>
          <button
            onClick={() => choose('visits')}
            className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25 transition-all duration-300 whitespace-nowrap"
          >
            {t('cookies.allowVisits', 'Allow visit counting')}
          </button>
        </div>
      </div>
    </div>
  );
};
