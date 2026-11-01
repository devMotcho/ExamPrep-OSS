import React from 'react';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '@/lib/online';

/** Shown over a page that was already loaded when the connection dropped. */
export const OfflineBanner: React.FC = () => {
  const online = useOnline();
  const { t } = useTranslation();
  if (online) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-3 z-40 flex justify-center bottom-[calc(var(--bottom-bar-h,0px)+0.75rem)]"
    >
      <p className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-lg">
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t('pwa.offline.banner', "You're offline. Changes can't be saved.")}
      </p>
    </div>
  );
};
