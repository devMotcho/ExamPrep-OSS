import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const CookieConsent: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAcceptEssential = () => {
    localStorage.setItem('cookie_consent', 'essential');
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
            {t('cookies.description', 'We use session cookies to keep you signed in, plus a device identifier stored in your browser to count visits. Nothing is used for advertising or shared with ad networks.')}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
          <button
            onClick={handleAcceptEssential}
            className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25 transition-all duration-300 whitespace-nowrap"
          >
            {t('cookies.acknowledge', 'Got it')}
          </button>
        </div>
      </div>
    </div>
  );
};
