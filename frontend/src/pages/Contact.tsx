import React, { useState } from 'react';
import { ContactForm } from '../components/ContactForm/ContactForm';
import { useLocation } from 'react-router-dom';
import { useConfig } from '../lib/config/useConfig';
import { useTranslation } from 'react-i18next';
import { Sparkles, Mail, Phone, MapPin, ExternalLink, Lock, Globe } from 'lucide-react';
import { NotFound } from './NotFound';

/**
 * Parses any user-inputted address or map link into a safe, embeddable iframe URL.
 */
const getGoogleMapsEmbedUrl = (input: string): string | null => {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. If it's an iframe tag, extract the src attribute
  if (trimmed.includes('<iframe')) {
    const srcMatch = trimmed.match(/src=["']([^"']+)["']/);
    if (srcMatch && srcMatch[1]) {
      return srcMatch[1];
    }
  }

  // 2. If it's already an embed URL, return it
  if (trimmed.startsWith('https://www.google.com/maps/embed') || trimmed.startsWith('https://maps.google.com/maps/embed')) {
    return trimmed;
  }

  // 3. If it's a standard google.com maps search link or place link
  if (trimmed.startsWith('https://www.google.com/maps/place/') || trimmed.startsWith('https://maps.google.com/')) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&output=embed`;
  }

  // 4. Plain text query string/address fallback
  return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&output=embed`;
};

export const Contact: React.FC = () => {
  const location = useLocation();
  const config = useConfig();
  const [mapUnlocked, setMapUnlocked] = useState(false);
  const { t } = useTranslation();

  const isEnabled = config.contact_enabled !== 'false';

  // 1. Return 404 Not Found if contact form is disabled
  if (!isEnabled) {
    return <NotFound />;
  }

  const metadata = {
    pathname: location.pathname,
    referrer: document.referrer || 'direct',
    userAgent: navigator.userAgent
  };

  // Resolve embedded maps link
  const rawMapsLink = config.google_maps_url || (config.address ? config.address : '');
  const embedUrl = getGoogleMapsEmbedUrl(rawMapsLink);

  const hasDirectChannels = !!(config.email_support || config.email_sales || config.phone_primary || config.phone_secondary);
  const hasLeftColumn = hasDirectChannels || !!config.address || !!embedUrl;

  return (
    <div className="relative min-h-[calc(100vh-60px)] bg-background font-sans selection:bg-primary selection:text-primary-foreground py-20 px-4 sm:px-6 lg:px-8">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/5 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-accent/5 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-[40%] left-[20%] w-[30vw] h-[30vw] rounded-full bg-primary/3 blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-16">
        
        {/* Title 4 Style Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-bold uppercase tracking-wide animate-bounce" style={{ animationDuration: '2s' }}>
            <Sparkles className="w-3.5 h-3.5" /> {t('contact.getInTouch')}
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground max-w-3xl">
            {t('contact.title1')} <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">{t('contact.title2')}</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl leading-relaxed mt-2">
            {t('contact.subtitle')}
          </p>
        </div>

        {/* Responsive Grid Layout */}
        {hasLeftColumn ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            
            {/* Left Column (lg:col-span-5) */}
            <div className="lg:col-span-5">
              <div className="bg-card/40 backdrop-blur-xl border border-border/60 rounded-3xl overflow-hidden shadow-sm group hover:border-primary/20 transition-all duration-500">
                
                {/* Section 1: Direct Channels */}
                {hasDirectChannels && (
                  <div className="p-8 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                        <Globe className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="font-bold text-lg text-foreground">{t('contact.directChannels.title')}</h2>
                        <p className="text-sm text-muted-foreground leading-snug">{t('contact.directChannels.subtitle')}</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {config.email_support && (
                        <div className="flex items-start gap-4">
                          <div className="p-2 bg-muted rounded-lg text-muted-foreground shrink-0 mt-0.5">
                            <Mail size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] text-muted-foreground font-extrabold uppercase tracking-wider block">{t('contact.directChannels.customerSupport')}</span>
                            <a href={`mailto:${config.email_support}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors mt-0.5 flex items-center min-h-11 md:min-h-0 break-all">{config.email_support}</a>
                          </div>
                        </div>
                      )}

                      {config.email_sales && (
                        <div className="flex items-start gap-4">
                          <div className="p-2 bg-muted rounded-lg text-muted-foreground shrink-0 mt-0.5">
                            <Mail size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] text-muted-foreground font-extrabold uppercase tracking-wider block">{t('contact.directChannels.salesInquiries')}</span>
                            <a href={`mailto:${config.email_sales}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors mt-0.5 flex items-center min-h-11 md:min-h-0 break-all">{config.email_sales}</a>
                          </div>
                        </div>
                      )}

                      {(config.phone_primary || config.phone_secondary) && (
                        <div className="flex items-start gap-4">
                          <div className="p-2 bg-muted rounded-lg text-muted-foreground shrink-0 mt-0.5">
                            <Phone size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] text-muted-foreground font-extrabold uppercase tracking-wider block">{t('contact.directChannels.callUs')}</span>
                            <div className="flex flex-col mt-0.5">
                              {config.phone_primary && (
                                <a href={`tel:${config.phone_primary}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors">{config.phone_primary}</a>
                              )}
                              {config.phone_secondary && (
                                <a href={`tel:${config.phone_secondary}`} className="text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5">{config.phone_secondary} ({t('contact.directChannels.alt')})</a>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Section 2: Address */}
                {config.address && (
                  <div className={`p-8 bg-muted/5 ${hasDirectChannels ? 'border-t border-border/40' : ''}`}>
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="font-bold text-lg text-foreground">{t('contact.headquarters.title')}</h2>
                        <p className="text-sm text-muted-foreground leading-snug">{t('contact.headquarters.subtitle')}</p>
                      </div>
                    </div>
                    
                    <p className="text-sm font-medium text-foreground leading-relaxed pl-1">{config.address}</p>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address)}`} target="_blank" rel="noopener noreferrer" className="inline-flex mt-4 text-xs font-bold text-primary items-center gap-1.5 hover:gap-2 transition-all">
                      {t('contact.headquarters.openInMaps')} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {/* Section 3: Interactive Map */}
                {embedUrl && (
                  <div className={`relative w-full h-[320px] bg-muted/10 overflow-hidden ${hasDirectChannels || config.address ? 'border-t border-border/40' : ''}`}>
                    <iframe
                      title={t('landing.contact.mapTitle', 'Map with our location')}
                      src={embedUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen={true}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className={`w-full h-full transition-all duration-500 ${!mapUnlocked ? "pointer-events-none filter brightness-90 grayscale-[0.3]" : "pointer-events-auto grayscale-0 brightness-100"}`}
                    />

                    {!mapUnlocked && (
                      <button
                        type="button"
                        onClick={() => setMapUnlocked(true)}
                        className="absolute inset-0 w-full bg-background/20 backdrop-blur-[2px] hover:backdrop-blur-[3px] transition-all flex flex-col items-center justify-center cursor-pointer p-4 group-hover:bg-background/30"
                      >
                        <span className="block bg-card/90 backdrop-blur border border-border/60 shadow-xl rounded-2xl p-6 text-center max-w-[280px] space-y-3 hover:scale-105 transition-transform duration-300">
                          <span className="mx-auto w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <MapPin size={20} aria-hidden="true" className="animate-bounce" style={{ animationDuration: '2s' }} />
                          </span>
                          <span className="block text-base font-black text-foreground">{t('contact.interactiveMap.title')}</span>
                          <span className="block text-xs text-muted-foreground">{t('contact.interactiveMap.subtitle')}</span>
                          <span className="flex items-center justify-center w-full h-8 rounded-lg text-xs font-bold bg-primary text-primary-foreground shadow-md shadow-primary/20">
                            {t('contact.interactiveMap.unlockMap')}
                          </span>
                        </span>
                      </button>
                    )}

                    {mapUnlocked && (
                      <button
                        onClick={() => setMapUnlocked(false)}
                        className="absolute bottom-4 right-4 bg-card/95 backdrop-blur border border-border text-foreground hover:text-primary shadow-lg rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Lock size={12} /> {t('contact.interactiveMap.lockMap')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (lg:col-span-7) */}
            <div className="lg:col-span-7">
              <div className="lg:sticky lg:top-24">
                <div className="bg-card/40 backdrop-blur-xl border border-border/60 rounded-3xl p-8 md:p-10 shadow-xl relative overflow-hidden group hover:border-primary/20 transition-all duration-500">
                   {/* Glowing background behind form */}
                   <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-primary/10 blur-3xl transition-colors duration-500 group-hover:bg-primary/15" />
                   <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-accent/10 blur-3xl transition-colors duration-500 group-hover:bg-accent/15" />
                   <div className="relative z-10">
                     <div className="mb-8 border-b border-border/40 pb-6">
                       <h2 className="text-2xl font-black text-foreground">{t('contact.form.title')}</h2>
                       <p className="text-sm text-muted-foreground mt-2">{t('contact.form.subtitle')}</p>
                     </div>
                     <ContactForm metadata={metadata} />
                   </div>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* Fallback Centered Layout */
          <div className="max-w-2xl mx-auto w-full">
            <div className="bg-card/40 backdrop-blur-xl border border-border/60 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden group hover:border-primary/20 transition-all duration-500">
               <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-primary/10 blur-3xl transition-colors duration-500 group-hover:bg-primary/20" />
               <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-accent/10 blur-3xl transition-colors duration-500 group-hover:bg-accent/20" />
               <div className="relative z-10">
                 <div className="text-center mb-10 border-b border-border/40 pb-8">
                   <h2 className="text-3xl font-black text-foreground">{t('contact.form.title')}</h2>
                   <p className="text-muted-foreground mt-2">{t('contact.form.subtitleAlt')}</p>
                 </div>
                 <ContactForm metadata={metadata} />
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

