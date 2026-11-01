import React from 'react';
import logoUrl from '@/assets/logo.svg';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProfessionalLoaderProps {
  message?: string;
  minHeightClass?: string;
}

export const ProfessionalLoader: React.FC<ProfessionalLoaderProps> = ({
  message,
  minHeightClass = 'min-h-screen',
}) => {
  const { t, i18n } = useTranslation();

  const defaultMsg =
    i18n && i18n.isInitialized
      ? t('common.loadingPlatform', 'Loading...')
      : 'Loading...';

  const displayMessage = message || defaultMsg;

  return (
    <div
      className={`flex flex-col items-center justify-center w-full bg-background p-6 select-none ${minHeightClass}`}
    >
      <div className="relative flex flex-col items-center max-w-sm text-center">
        {/* Glowing Background Aura */}
        <div className="absolute -inset-4 bg-gradient-to-r from-primary/30 via-purple-500/20 to-indigo-500/30 rounded-full blur-2xl animate-pulse -z-10" />

        {/* Logo Wrapper with Rotating Ring */}
        <div className="relative flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 mb-6">
          {/* Outer Rotating Ring */}
          <div className="absolute inset-0 rounded-3xl border-2 border-dashed border-primary/40 animate-[spin_12s_linear_infinite]" />
          <div className="absolute inset-1 rounded-2xl border border-primary/20 bg-card/80 backdrop-blur-xl shadow-xl flex items-center justify-center p-4">
            <img
              src={logoUrl}
              alt=""
              className="w-full h-full object-contain drop-shadow-md animate-pulse"
            />
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground mb-2">
          escolha<span className="bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">multipla.pt</span>
        </h1>

        {/* Status Message */}
        <div className="flex items-center justify-center gap-2.5 text-xs sm:text-sm font-semibold text-muted-foreground bg-muted/40 border border-border/60 px-4 py-2 rounded-full shadow-sm mt-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
          <span className="tracking-wide">{displayMessage}</span>
        </div>

        {/* Subtle bottom progress bar */}
        <div className="w-36 h-1 bg-muted rounded-full overflow-hidden mt-6">
          <div className="w-1/2 h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
        </div>
      </div>
    </div>
  );
};
