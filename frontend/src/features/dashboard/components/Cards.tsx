import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Mail, UserCheck, Activity, Laptop, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DashboardStats } from '../types';

export const SystemStatusAndGatewaysCard: React.FC<{ stats: DashboardStats }> = ({ stats }) => {
  const { t } = useTranslation();
  
  const resolvedCount = stats.totalMessages - stats.unreadMessages;
  const resolutionRate = stats.totalMessages > 0 ? Math.round((resolvedCount / stats.totalMessages) * 100) : 100;
  const resCircleCircumference = 2 * Math.PI * 45;
  const resStrokeOffset = resCircleCircumference - (resolutionRate / 100) * resCircleCircumference;

  return (
    <div className="bg-card/65 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-border/50 shadow-md space-y-6 flex flex-col justify-between">
      <div className="pb-2 border-b border-border/40">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ShieldCheck className="h-4.5 w-4.5 text-primary animate-pulse" /> {t('dashboard.system.title', 'System Status & Gateways')}
        </h2>
        <p className="text-xs text-muted-foreground">{t('dashboard.system.desc', 'Real-time status of critical communication channels and platform telemetry.')}</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
        <div className="relative h-28 w-28 flex items-center justify-center group shrink-0">
          <svg viewBox="0 0 112 112" className="absolute w-full h-full transform -rotate-90">
            <circle 
              cx="56" cy="56" r="45" fill="transparent" stroke="currentColor" strokeWidth="8" 
              className="text-muted/40 dark:text-muted/20"
            />
            <circle 
              cx="56" cy="56" r="45" fill="transparent" stroke="hsl(var(--primary))" strokeWidth="8" 
              strokeDasharray={resCircleCircumference} strokeDashoffset={resStrokeOffset} strokeLinecap="round"
              className="stroke-primary transition-all duration-500 ease-out"
            />
          </svg>
          <div className="text-center z-10 space-y-0.5">
            <span className="text-2xl font-black tracking-tight">{resolutionRate}%</span>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold leading-none">{t('dashboard.system.resolved', 'Resolved')}</p>
          </div>
        </div>

        <div className="space-y-2 flex-1 w-full text-xs font-bold">
          <div className="flex items-center justify-between py-1 border-b border-border/30">
            <span className="text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-primary/70" /> {t('dashboard.system.emailSmtp', 'Email SMTP')}</span>
            {stats.emailChannelActive ? (
              <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-black tracking-wide uppercase border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400">{t('dashboard.system.active', 'Active')}</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-black tracking-wide uppercase border-border/60 bg-muted/30 text-muted-foreground">{t('dashboard.system.inactive', 'Inactive')}</Badge>
            )}
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5 text-primary/70" /> {t('dashboard.system.signupsGate', 'Signups Gate')}</span>
            {stats.registrationOpen ? (
              <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-black tracking-wide uppercase border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400">{t('dashboard.system.publicOpen', 'Public Open')}</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-black tracking-wide uppercase border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400">{t('dashboard.system.restricted', 'Restricted')}</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="bg-muted/40 rounded-xl p-3 border border-border/30 space-y-2">
        <div className="flex justify-between items-center text-[11px] font-bold text-muted-foreground uppercase">
          <span>{t('dashboard.system.platformMatrix', 'Platform Matrix')}</span>
          <span className="text-emerald-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {t('dashboard.system.secureConnection', 'Secure Connection')}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-muted-foreground pt-1 select-text">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">{t('dashboard.system.activeAdmins', 'Active Admins')}</span>
            <span className="text-foreground font-extrabold">{stats.adminCount} {t('dashboard.system.accounts', 'Accounts')}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">{t('dashboard.system.corsScope', 'CORS Scope')}</span>
            <span className="text-foreground truncate font-extrabold">localhost:5173</span>
          </div>
          <div className="flex flex-col gap-0.5 col-span-2 pt-1 border-t border-border/30">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">{t('dashboard.system.telemetryEngine', 'Telemetry Engine')}</span>
            <span className="text-foreground flex items-center gap-1 font-extrabold">
              <Activity size={10} className="text-primary animate-pulse" /> {t('dashboard.system.postgres', 'PostgreSQL Persistence (Live Queries)')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DeviceAnalyticsCard: React.FC<{ stats: DashboardStats }> = ({ stats }) => {
  const { t } = useTranslation();
  
  const totalDevices = stats.totalDevices || 0;
  const authDevices = stats.authenticatedDevices || 0;
  const visitorDevices = stats.visitorDevices || 0;
  
  const authenticatedPercentage = totalDevices > 0 ? Math.round((authDevices / totalDevices) * 100) : 0;
  
  const engCircleCircumference = 2 * Math.PI * 45;
  const engStrokeOffset = engCircleCircumference - (authenticatedPercentage / 100) * engCircleCircumference;
  
  let trafficQuality = "Stable";
  let trafficQualityColor = "border-indigo-500/30 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400";
  if (authenticatedPercentage > 50) {
    trafficQuality = "High Quality";
    trafficQualityColor = "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400";
  } else if (authenticatedPercentage < 20 && totalDevices > 5) {
    trafficQuality = "High Guest Volume";
    trafficQualityColor = "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400";
  }

  return (
    <div className="bg-card/65 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-border/50 shadow-md space-y-6 flex flex-col h-full">
      <div className="pb-2 border-b border-border/40 shrink-0">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Laptop className="h-4.5 w-4.5 text-primary animate-pulse" /> {t('dashboard.analytics.deviceVisitorAnalytics', 'Device & Visitor Analytics')}
        </h2>
        <p className="text-xs text-muted-foreground">{t('dashboard.analytics.deviceVisitorDesc', 'Unique browser devices connected to the platform classified by session state.')}</p>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
        <div className="relative h-28 w-28 flex items-center justify-center group shrink-0 select-none">
          <svg viewBox="0 0 112 112" className="absolute w-full h-full transform -rotate-90">
            <circle 
              cx="56" cy="56" r="45" fill="transparent" stroke="currentColor" strokeWidth="8" 
              className="text-muted/40 dark:text-muted/20"
            />
            <circle 
              cx="56" cy="56" r="45" fill="transparent" stroke="hsl(var(--primary))" strokeWidth="8" 
              strokeDasharray={engCircleCircumference} strokeDashoffset={engStrokeOffset} strokeLinecap="round"
              className="stroke-primary transition-all duration-500 ease-out"
            />
          </svg>
          <div className="text-center z-10 space-y-0.5">
            <span className="text-2xl font-black tracking-tight">{authenticatedPercentage}%</span>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold leading-none">{t('dashboard.analytics.loggedIn', 'Logged In')}</p>
          </div>
        </div>

        <div className="space-y-2 flex-1 w-full text-xs font-bold">
          <div className="flex items-center justify-between py-1 border-b border-border/30">
            <span className="text-muted-foreground flex items-center gap-1.5"><Laptop className="h-3.5 w-3.5 text-primary/70" /> {t('dashboard.analytics.totalDevices', 'Total Devices')}</span>
            <span className="text-foreground font-extrabold">{totalDevices.toLocaleString()} {t('dashboard.analytics.pcs', 'PCs')}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-border/30">
            <span className="text-muted-foreground flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5 text-primary/70" /> {t('dashboard.analytics.memberPcs', 'Member PCs')}</span>
            <span className="text-foreground font-extrabold">{authDevices.toLocaleString()} {t('dashboard.analytics.verified', 'verified')}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-border/30">
            <span className="text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary/70" /> {t('dashboard.analytics.visitorGuestPcs', 'Visitor Guest PCs')}</span>
            <span className="text-foreground font-extrabold">{visitorDevices.toLocaleString()} {t('dashboard.analytics.guestsLabel', 'guests')}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-primary/70" /> {t('dashboard.analytics.trafficIndex', 'Traffic Index')}</span>
            <Badge variant="outline" className={`text-[10px] py-0.5 px-2 font-black tracking-wide uppercase ${trafficQualityColor}`}>
              {t(`dashboard.analytics.traffic${trafficQuality.replace(/\s+/g, '')}`, trafficQuality)}
            </Badge>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
