import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  isIosSafari,
  isStandalone,
  promptInstall,
  rememberInstallDismissed,
  useCanPromptInstall,
  wasInstallDismissed,
} from '@/pwa/install';

/**
 * Offers the install once the student has seen what the app is for. Render it only for someone
 * who has completed an exam. Dismissing it is remembered on this device.
 */
export const InstallPrompt: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const canPrompt = useCanPromptInstall();
  const [dismissed, setDismissed] = useState(wasInstallDismissed);
  const ios = !canPrompt && isIosSafari();

  if (dismissed || isStandalone() || (!canPrompt && !ios)) return null;

  const dismiss = () => {
    rememberInstallDismissed();
    setDismissed(true);
  };

  return (
    <aside className={`relative rounded-2xl border border-primary/20 bg-primary/5 p-4 pr-12 ${className}`}>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('pwa.install.dismiss', 'Dismiss')}
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <h2 className="text-sm font-black text-foreground">{t('pwa.install.title', 'Install the app')}</h2>
      {ios ? (
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t('pwa.install.iosStart', 'In Safari, tap')}{' '}
          <Share className="inline h-4 w-4 align-text-bottom text-foreground" aria-label={t('pwa.install.iosShare', 'Share')} />{' '}
          {t('pwa.install.iosEnd', 'then "Add to Home Screen".')}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t('pwa.install.description', 'Keep your exams one tap away, full screen, without opening the browser.')}
          </p>
          <Button type="button" onClick={() => promptInstall()} className="mt-3 h-11 gap-2 px-5 font-bold">
            <Download className="h-4 w-4" aria-hidden="true" />
            {t('pwa.install.action', 'Install')}
          </Button>
        </>
      )}
    </aside>
  );
};
