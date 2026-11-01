import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { checkConnection } from '@/lib/online';

/** Full-page state for screens that need the server, which is all of them with user data. */
export const OfflineState: React.FC<{ description?: string }> = ({ description }) => {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <div className="rounded-full bg-muted p-4 text-muted-foreground">
        <WifiOff className="h-8 w-8" aria-hidden="true" />
      </div>
      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-black text-foreground">{t('pwa.offline.title', "You're offline")}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description || t('pwa.offline.description', 'This page needs an internet connection. It will load by itself when you are back online.')}
        </p>
      </div>
      <Button type="button" variant="outline" onClick={() => checkConnection()} className="h-11 gap-2 px-5 font-semibold">
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        {t('common.retry', 'Try again')}
      </Button>
    </div>
  );
};
