import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { applyUpdate, isExamRoute, useUpdateAvailable } from '@/pwa/serviceWorker';

export const UpdatePrompt: React.FC = () => {
  const available = useUpdateAvailable();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  // During an exam it stays hidden, and it appears once the student leaves.
  if (!available || dismissed || isExamRoute(pathname)) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 z-[60] mx-auto flex max-w-md items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-xl bottom-[calc(var(--bottom-bar-h,0px)+0.75rem)] md:left-auto md:right-6 md:mx-0"
    >
      <p className="min-w-0 pl-1 text-sm font-semibold">{t('pwa.update.title', 'New version available')}</p>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" onClick={() => setDismissed(true)} className="h-10 px-3 text-sm">
          {t('pwa.update.later', 'Not now')}
        </Button>
        <Button type="button" onClick={applyUpdate} className="h-10 px-4 text-sm font-bold">
          {t('pwa.update.reload', 'Reload')}
        </Button>
      </div>
    </div>
  );
};
