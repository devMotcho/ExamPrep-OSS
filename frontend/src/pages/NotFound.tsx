import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Home, Mail, ArrowLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/hooks/useLocale';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@/lib/config/useConfig';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const { t } = useTranslation();
  const config = useConfig();
  const [clickCount, setClickCount] = useState(0);

  // A fun little Easter egg for users who click the "404" multiple times
  const handleEasterEgg = () => {
    setClickCount((prev) => prev + 1);
  };

  return (
    <div className="relative min-h-[calc(100vh-72px)] flex flex-col items-center justify-center bg-background font-sans selection:bg-primary selection:text-primary-foreground py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
      
      {/* Background Glowing Ambient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/10 blur-[130px] animate-pulse duration-[8000ms]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-accent/10 blur-[120px] animate-pulse duration-[10000ms]" />
        
        {/* Bouncing abstract grid particles */}
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      <div className="w-full max-w-lg relative z-10 space-y-8 flex flex-col items-center">
        
        {/* Animated Icon / Visual Header */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-ping opacity-75 duration-[3000ms]" />
          <div className="w-20 h-20 rounded-2xl bg-card border border-border/60 shadow-xl flex items-center justify-center relative z-10 transition-transform duration-300 hover:rotate-12 cursor-pointer">
            <AlertCircle size={36} className="text-primary animate-pulse" />
          </div>
        </div>

        {/* Glassmorphic Error Container */}
        <div className="w-full bg-card/65 backdrop-blur-md border border-border/50 shadow-2xl rounded-2xl p-8 text-center space-y-6">
          
          <div className="space-y-2">
            {/* Interactive Easter-Egg Trigger */}
            <h1 
              onClick={handleEasterEgg}
              className="text-7xl font-black tracking-tighter text-foreground cursor-pointer select-none select-none transition-all duration-300 hover:scale-105 active:scale-95 bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-accent"
              title="Click me!"
            >
              404
            </h1>
            
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              {clickCount >= 10 ? t('notFound.secretTitle') : t('notFound.title')}
            </h2>
            
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {clickCount >= 10 ? t('notFound.secretDescription') : t('notFound.description')}
            </p>
          </div>

          {/* Action Navigation Cluster */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              onClick={() => navigate(`/${locale}`)}
              className="flex items-center justify-center gap-2 h-10 px-5 font-bold shadow-md shadow-primary/10 rounded-xl"
            >
              <Home size={15} />
              <span>{t('notFound.goBackHome')}</span>
            </Button>
            
            {config.contact_enabled !== 'false' && (
              <Button
                variant="outline"
                onClick={() => navigate(`/${locale}/contact`)}
                className="flex items-center justify-center gap-2 h-10 px-5 font-bold border-border/60 bg-muted/30 hover:bg-muted/60 rounded-xl"
              >
                <Mail size={15} />
                <span>{t('notFound.contactSupport')}</span>
              </Button>
            )}
          </div>

          <div className="border-t border-border/40 pt-4 flex justify-between items-center text-xs">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 hover:text-primary font-bold text-muted-foreground transition-colors group"
            >
              <ArrowLeft size={13} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
              <span>{t('notFound.returnToPrevious')}</span>
            </button>

            <span className="flex items-center gap-1 text-muted-foreground select-none">
              <HelpCircle size={12} />
              <span>{t('notFound.errorCode')}: 404_ABSENT</span>
            </span>
          </div>

        </div>

      </div>
    </div>
  );
};
