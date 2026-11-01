import React from 'react';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '@/lib/utils';
import { useConfig } from '@/lib/config/useConfig';

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useLocale();
  const config = useConfig();

  const multiLangEnabled = config?.multi_lang_enabled !== 'false';
  if (!multiLangEnabled) {
    return null;
  }

  return (
    <div className="inline-flex bg-muted/50 p-1 rounded-xl border border-border/40 gap-1 backdrop-blur-sm shrink-0">
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={cn(
          'px-2.5 py-1 text-xs font-bold rounded-lg transition-all',
          locale === 'en'
            ? 'bg-card text-primary shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-card/20'
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale('pt')}
        className={cn(
          'px-2.5 py-1 text-xs font-bold rounded-lg transition-all',
          locale === 'pt'
            ? 'bg-card text-primary shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-card/20'
        )}
      >
        PT
      </button>
    </div>
  );
};
