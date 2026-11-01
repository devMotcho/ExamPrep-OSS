import { StudentDashboard as StudentDashboardView } from '@/components/dashboard/StudentDashboard';
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '@/hooks/useLocale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { ContactDetailDialog } from '../components/admin/ContactDetailDialog';
import { UserDetailDialog } from '../components/admin/UserDetailDialog';
import { useUsers, UserFormDialog, UserResetPasswordDialog, UserDeleteDialog } from '@/features/users';
import { authService } from '@/features/auth';
import type { User } from '@/features/users/types';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '@/lib/config/useConfig';
import { useToast } from '@/context/ToastContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, RefreshCw, Mail, MessageSquare, UserCheck, Laptop, Users, TrendingUp, Cpu, Calendar, Bell, ChevronRight, Clock, CheckCircle2, Sparkles } from 'lucide-react';
import { useDashboardStats, SystemStatusAndGatewaysCard, DeviceAnalyticsCard, SmoothLineChart, CustomBarChart } from '@/features/dashboard';
import { useTranslation } from 'react-i18next';
import type { UserActivity, MessageActivity } from '@/features/dashboard/types';

export const Dashboard: React.FC = () => {
  const { role, user, refreshUser } = useAuth();
  const { locale } = useLocale();
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'student' | 'admin' | 'system'>(
    (role === 'ROLE_ADMIN' || role === 'ROLE_DEV') ? 'admin' : 'student'
  );
  const [userPeriod, setUserPeriod] = useState<'7d' | '30d'>('7d');
  const [activeTab, setActiveTab] = useState<'registrations' | 'inquiries'>('registrations');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  
  // Selected inquiry to pass to ContactDetailDialog
  const [selectedMessage, setSelectedMessage] = useState<MessageActivity | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserActivity | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const isAdminOrDev = role === 'ROLE_ADMIN' || role === 'ROLE_DEV';
  const { 
    stats, loading, error, 
    fetchStats, markMessageRead, refreshMessage 
  } = useDashboardStats(isAdminOrDev);

  const { toast } = useToast();
  const config = useConfig();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const {
    isModalOpen, editingUser, formData, formErrors, isSubmitting,
    openModal, closeModal, setField, handleSubmit
  } = useUsers();



  const handleSendCode = async () => {
    if (sendingCode) return;
    if (!user?.email) return;
    setSendingCode(true);
    try {
      await authService.sendCode(user.email);
      toast({ type: 'success', message: t('dashboard.toast.codeSent', 'Verification code sent to your email.') });
      setCountdown(60);
    } catch (err: any) {
      toast({ type: 'error', message: err.response?.data?.message || t('dashboard.toast.codeFailed', 'Failed to send verification code.') });
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!confirmCode.trim()) {
      toast({ type: 'error', message: t('dashboard.toast.codeRequired', 'Verification code is required.') });
      return;
    }
    setVerifyingEmail(true);
    try {
      await authService.confirmEmail(confirmCode);
      toast({ type: 'success', message: t('dashboard.toast.emailConfirmed', 'Email confirmed successfully!') });
      setConfirmOpen(false);
      setConfirmCode('');
      await refreshUser();
    } catch (err: any) {
      toast({ type: 'error', message: err.response?.data?.message || t('dashboard.toast.emailFailed', 'Failed to confirm email.') });
    } finally {
      setVerifyingEmail(false);
    }
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // View details and mark as read immediately if unread
  const handleSelectMessage = useCallback(async (msg: MessageActivity) => {
    setSelectedMessage(msg);
    await markMessageRead(msg);
  }, [markMessageRead]);

  const handleDialogUpdate = useCallback(async () => {
    // Patch selectedMessage with the latest status from the full messages list
    setSelectedMessage(prev => {
      if (!prev) return null;
      return prev;
    });
    
    if (selectedMessage?.id) {
      const refreshedMsg = await refreshMessage(selectedMessage.id);
      if (refreshedMsg) {
        setSelectedMessage(prev => {
          if (!prev) return null;
          return {
            ...prev,
            isRead: refreshedMsg.read ?? refreshedMsg.isRead,
            statusId: refreshedMsg.status?.id ?? null,
            statusName: refreshedMsg.status?.name ?? null,
            statusColor: refreshedMsg.status?.color ?? null,
            type: refreshedMsg.type,
            sentChannels: refreshedMsg.sentChannels,
            ipAddress: refreshedMsg.ipAddress,
            replyMessage: refreshedMsg.replyMessage,
          };
        });
      }
    }
    
    fetchStats();
  }, [selectedMessage?.id, fetchStats, refreshMessage]);

  const activePercentage = stats && stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0;

  return (
    <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-7xl space-y-8 relative">
      {config.confirmation_code_enabled === 'true' && user && !user.isConfirmed && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 px-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0">
              <ShieldAlert className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">{t('dashboard.alerts.emailVerificationReq', 'Email Verification Required')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-normal">{t('dashboard.alerts.emailVerificationDesc', 'Your account email address is not yet confirmed. Please verify your email to secure your account.')}</p>
            </div>
          </div>
          <Button 
            onClick={() => {
              setConfirmOpen(true);
              handleSendCode();
            }}
            variant="outline" 
            size="sm" 
            className="h-9 rounded-xl border-amber-500/35 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold shrink-0 self-start sm:self-center"
          >
            {t('dashboard.alerts.confirmEmail', 'Confirm Email')}
          </Button>
        </div>
      )}

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full space-y-6">
        {/* ── TOP HEADER SECTION ── */}
        <div className="bg-card/65 backdrop-blur-md px-4 py-3 sm:p-6 rounded-2xl border border-border/50 shadow-md bg-gradient-to-br from-card to-primary/[0.02] relative overflow-hidden group">
          <div className="hidden sm:block absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Sparkles className="h-28 w-28 text-primary" />
          </div>
          <div className="space-y-1 relative z-10">
            <TabsContent value="student" className="mt-0">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{t('studentDashboard.title', 'Student Dashboard')}</h1>
              <p className="hidden sm:block text-muted-foreground text-sm font-medium">{t('studentDashboard.description', 'Access collaborative MCQ study areas, track exam sessions, and verify scores.')}</p>
            </TabsContent>
            <TabsContent value="admin" className="mt-0">
              <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{t('dashboard.title', 'Admin Dashboard')}</h1>
                <Badge variant="outline" className="w-fit h-5 gap-1 py-0 px-2 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> {t('dashboard.header.liveTelemetry', 'Live Telemetry')}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm font-medium">{t('dashboard.header.adminDesc', 'Users, registrations, analytics, and recent activity overview.')}</p>
            </TabsContent>
            <TabsContent value="system" className="mt-0">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{t('dashboard.header.systemTitle', 'System View')}</h1>
              <p className="text-muted-foreground text-sm font-medium">{t('dashboard.header.systemDesc', 'Database health, engine telemetry, system statuses, and communication gateways.')}</p>
            </TabsContent>
          </div>
        </div>

        {/* ── TAB NAVIGATION ── */}
        {(role === 'ROLE_ADMIN' || role === 'ROLE_DEV') && (
        <TabsList className="w-full">
          <TabsTrigger value="student">{t('studentDashboard.studentView', 'Student View')}</TabsTrigger>
          {(role === 'ROLE_ADMIN' || role === 'ROLE_DEV') && (
            <TabsTrigger value="admin">{t('dashboard.tabs.adminView', 'Admin View')}</TabsTrigger>
          )}
          {role === 'ROLE_DEV' && (
            <TabsTrigger value="system">{t('dashboard.tabs.systemView', 'System View')}</TabsTrigger>
          )}
        </TabsList>
        )}

        {/* ── CONTENTS ── */}
        <TabsContent value="student" className="mt-0">
          <StudentDashboardView />
          {confirmOpen && (
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogContent className="sm:max-w-[420px] w-[calc(100%-2rem)] !flex !flex-col !gap-0 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-0 overflow-hidden z-[70] animate-in zoom-in-95 duration-200">
                <DialogHeader className="p-6 pb-4 border-b border-border/40 space-y-1.5 shrink-0 bg-gradient-to-br from-card to-amber-500/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-sm shrink-0">
                      <Mail size={15} strokeWidth={2.5} />
                    </div>
                    <DialogTitle className="text-base font-black leading-tight text-foreground">
                      {t('dashboard.alerts.verifyEmail', 'Verify Your Email')}
                    </DialogTitle>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1.5 font-medium leading-relaxed">
                    {t('dashboard.alerts.verifyEmailDesc1', 'We have triggered a 6-digit confirmation code to your email address: ')}<strong className="text-foreground">{user?.email}</strong>{t('dashboard.alerts.verifyEmailDesc2', '. Please enter the code below.')}
                  </p>
                </DialogHeader>

                <div className="grid gap-5 p-6 py-5 overflow-y-auto bg-card/20">
                  <div className="space-y-2">
                    <Label htmlFor="dashboard-confirm-code-student" className="text-xs font-bold text-foreground">
                      {t('dashboard.alerts.verificationCode', 'Verification Code')} <span className="text-danger">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="dashboard-confirm-code-student"
                        value={confirmCode}
                        onChange={(e) => setConfirmCode(e.target.value)}
                        placeholder={t('dashboard.alerts.enterCode', 'Enter 6-digit code')}
                        className="h-9 rounded-xl border-border/60 text-xs font-medium bg-background/30"
                        maxLength={6}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSendCode}
                        disabled={sendingCode || countdown > 0}
                        className="h-9 rounded-xl font-bold text-xs shrink-0 px-4 border-border/60 hover:bg-muted"
                      >
                        {sendingCode ? t('dashboard.alerts.sending', 'Sending...') : countdown > 0 ? t('dashboard.alerts.resendIn', { defaultValue: 'Resend in {{seconds}}s', seconds: countdown }) : t('dashboard.alerts.resendCode', 'Resend Code')}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="!mx-0 !mb-0 !flex !flex-row !items-center !justify-end border-t border-border/40 !p-4 !px-6 bg-muted/20 shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setConfirmOpen(false);
                      setConfirmCode('');
                    }}
                    disabled={verifyingEmail}
                    className="h-9 rounded-xl font-bold text-xs hover:bg-muted px-4"
                  >
                    {t('dashboard.alerts.cancel', 'Cancel')}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleVerifyEmail}
                    disabled={verifyingEmail || !confirmCode.trim()}
                    className="h-9 rounded-xl font-bold text-xs bg-warning hover:bg-warning/90 text-warning-foreground px-4 border border-amber-500/10"
                  >
                    {verifyingEmail ? t('dashboard.alerts.verifying', 'Verifying...') : t('dashboard.alerts.verifyButton', 'Verify Email')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="admin" className="mt-0 space-y-8">
          {loading ? (
            <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-7xl space-y-8 animate-pulse">
              <div className="h-20 bg-muted/60 rounded-xl" />
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="h-32 bg-muted/50 rounded-xl border border-border/40" />
                ))}
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 h-96 bg-muted/50 rounded-xl border border-border/40" />
                <div className="h-96 bg-muted/50 rounded-xl border border-border/40" />
              </div>
            </div>
          ) : (error || !stats) ? (
            <div className="container mx-auto py-12 px-4 max-w-2xl text-center space-y-6">
              <div className="inline-flex p-4 rounded-full bg-danger/10 text-danger border border-danger/25">
                <ShieldAlert className="h-10 w-10" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.error.handshakeFailure', 'Telemetry Handshake Failure')}</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">{error || t('dashboard.error.couldNotRetrieve', "Could not retrieve statistics.")}</p>
              <Button onClick={() => fetchStats(true)} className="gap-2">
                <RefreshCw className="h-4 w-4" /> {t('dashboard.error.retryHandshake', 'Retry Handshake')}
              </Button>
            </div>
          ) : (
            <>
          {/* ── METRICS GRID (4 CARDS) ── */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            
            {/* Card 1: Total Registered Users -> New Users (7-Day / 30-Day Rolling) */}
            <div className="bg-card/60 backdrop-blur border border-border/60 rounded-2xl p-6 space-y-4 hover:-translate-y-1 transition-all duration-300 w-full shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Users className="w-24 h-24 text-primary" />
              </div>
              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t('dashboard.stats.newUsers', 'NEW USERS (7-DAY / 30-DAY)')}</span>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="relative z-10 flex items-end justify-between">
                <span className="text-3xl font-black text-foreground">
                  {userPeriod === '7d' ? stats.newUsers7Days.toLocaleString() : stats.newUsers30Days.toLocaleString()}
                </span>
                <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
                  <button onClick={() => setUserPeriod('7d')} className={`text-[11px] font-bold min-w-11 px-2 py-1 rounded-md transition-colors ${userPeriod === '7d' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>7D</button>
                  <button onClick={() => setUserPeriod('30d')} className={`text-[11px] font-bold min-w-11 px-2 py-1 rounded-md transition-colors ${userPeriod === '30d' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>30D</button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 relative z-10 pt-4 border-t border-border/40">
                <Badge variant="outline" className={`text-[11px] font-bold ${(userPeriod === '7d' ? stats.newUsers7DaysGrowth : stats.newUsers30DaysGrowth) >= 0 ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10' : 'border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/10'}`}>
                  {(userPeriod === '7d' ? stats.newUsers7DaysGrowth : stats.newUsers30DaysGrowth) > 0 ? '+' : ''}{userPeriod === '7d' ? stats.newUsers7DaysGrowth : stats.newUsers30DaysGrowth}%
                </Badge>
                <div className="flex items-center gap-1 group/info relative cursor-help">
                  <span className="text-xs text-muted-foreground font-medium">{t('dashboard.stats.vsPreviousPeriod', 'vs previous period')}</span>
                  <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[11px] text-muted-foreground">i</div>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 text-center pointer-events-none">
                    {t('dashboard.stats.newUsersInfo', 'Shows the number of new registrations in the selected period compared to the previous equivalent period.')}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Active Users */}
            <div className="bg-card/60 backdrop-blur border border-border/60 rounded-2xl p-6 space-y-4 hover:-translate-y-1 transition-all duration-300 w-full shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                 <UserCheck className="w-24 h-24 text-blue-500" />
              </div>
              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t('dashboard.stats.active', 'Active')}</span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-blue-500" />
                </div>
              </div>
              <div className="relative z-10">
                <span className="text-3xl font-black text-foreground">{stats.activeUsers.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 relative z-10 pt-4 border-t border-border/40">
                <Badge variant="outline" className="text-[11px] font-bold border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10">
                  {activePercentage}%
                </Badge>
                <div className="flex items-center gap-1 group/info relative cursor-help">
                  <span className="text-xs text-muted-foreground font-medium">{t('dashboard.stats.activeLabel', 'active users')}</span>
                  <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[11px] text-muted-foreground">i</div>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 text-center pointer-events-none">
                    {t('dashboard.stats.activeRatio', { defaultValue: 'of all registered users', percentage: activePercentage })}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Support Messages */}
            <div className="bg-card/60 backdrop-blur border border-border/60 rounded-2xl p-6 space-y-4 hover:-translate-y-1 transition-all duration-300 w-full shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                 <MessageSquare className="w-24 h-24 text-amber-500" />
              </div>
              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t('dashboard.stats.messages', 'Messages')}</span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <div className="relative z-10">
                <span className="text-3xl font-black text-foreground">{stats.totalMessages.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 relative z-10 pt-4 border-t border-border/40">
                {stats.unreadMessages > 0 ? (
                  <>
                    <Badge variant="outline" className="text-[11px] font-bold border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10 animate-pulse">
                      {stats.unreadMessages}
                    </Badge>
                    <div className="flex items-center gap-1 group/info relative cursor-help">
                      <span className="text-xs text-muted-foreground font-medium">{t('dashboard.stats.unreadLabel', 'unread')}</span>
                      <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[11px] text-muted-foreground">i</div>
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 text-center pointer-events-none">
                        {t('dashboard.stats.messagesInfo', 'Total support messages received, highlighting the ones requiring attention.')}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1 group/info relative cursor-help">
                    <span className="text-xs text-muted-foreground font-medium">{t('dashboard.stats.noUnread', 'No unread messages')}</span>
                    <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[11px] text-muted-foreground">i</div>
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 text-center pointer-events-none">
                      {t('dashboard.stats.messagesInfo', 'Total support messages received, highlighting the ones requiring attention.')}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 4: Monitored Devices */}
            <div className="bg-card/60 backdrop-blur border border-border/60 rounded-2xl p-6 space-y-4 hover:-translate-y-1 transition-all duration-300 w-full shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Laptop className="w-24 h-24 text-purple-500" />
              </div>
              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t('dashboard.stats.devices', 'Devices')}</span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Laptop className="w-4 h-4 text-purple-500" />
                </div>
              </div>
              <div className="relative z-10">
                <span className="text-3xl font-black text-foreground">{stats.totalDevices.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 relative z-10 pt-4 border-t border-border/40">
                <Badge variant="outline" className="text-[11px] font-bold border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10">
                  {stats.visitorDevices}
                </Badge>
                <div className="flex items-center gap-1 group/info relative cursor-help">
                  <span className="text-xs text-muted-foreground font-medium">{t('dashboard.stats.guestsLabel', 'guests')}</span>
                  <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[11px] text-muted-foreground">i</div>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 text-center pointer-events-none">
                    {t('dashboard.stats.guests', { defaultValue: 'guests currently active', count: stats.visitorDevices })}
                  </div>
                </div>
              </div>
            </div>

          </div>

                    {/* ── DUAL COLUMN FEEDS ── */}
          <div className="grid gap-6 md:grid-cols-2">
            
            {/* Column 1: Recent User Additions */}
            <div className="bg-card/65 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-border/50 shadow-md space-y-4 overflow-hidden min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Users className="h-4.5 w-4.5 text-primary" /> {t('dashboard.recentRegistrations.title')}
                  </h2>
                  <p className="text-xs text-muted-foreground">{t('dashboard.recentRegistrations.desc')}</p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <Badge variant="outline" className="font-bold text-[11px] border-border/60 shrink-0">{t('dashboard.recentRegistrations.new')}</Badge>
                  <Link 
                    to={`/${locale}/admin/users`} 
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors bg-primary/5 hover:bg-primary/10 px-2.5 py-1 min-h-11 md:min-h-0 rounded-lg border border-primary/20 shrink-0"
                  >
                    {t('dashboard.recentRegistrations.viewAll')} <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                {stats.recentUsers && stats.recentUsers.length > 0 ? (
                  stats.recentUsers.map((user: UserActivity, idx: number) => {
                    const initials = user.name
                      ? user.name.split(/\s+/).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                      : user.email.slice(0, 2).toUpperCase();
                    return (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedUser(user)}
                        className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-4 p-3 cursor-pointer group hover:bg-muted/30 rounded-xl transition-all duration-200 border border-border/20 hover:border-border/40"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{user.name || t('dashboard.recentRegistrations.anonymous')}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex flex-row items-center justify-between lg:flex-col lg:items-end gap-1.5 shrink-0 pl-0 lg:pl-2 w-full lg:w-auto border-t border-border/10 pt-2 lg:border-0 lg:pt-0">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[11px] py-0.5 px-1.5 font-bold tracking-wide uppercase border-primary/30 text-primary w-fit">
                              {user.role}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {user.createdAt !== 'N/A' && user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">{t('dashboard.recentRegistrations.empty')}</div>
                )}
              </div>
            </div>

            {/* Column 2: Recent Support Inquiries (Only status-less messages) */}
            <div className="bg-card/65 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-border/50 shadow-md space-y-4 overflow-hidden min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Bell className="h-4.5 w-4.5 text-primary animate-pulse" /> {t('dashboard.recentNotifications.title')}
                  </h2>
                  <p className="text-xs text-muted-foreground">{t('dashboard.recentNotifications.desc')}</p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  {stats.unreadMessages > 0 && (
                    <Badge variant="outline" className="font-bold text-[11px] py-0.5 px-2 border-amber-500/35 bg-amber-500/5 text-amber-700 dark:text-amber-400 animate-pulse shrink-0">
                      {stats.unreadMessages} {t('dashboard.recentNotifications.awaiting')}
                    </Badge>
                  )}
                  <Link 
                    to={`/${locale}/admin/notifications`} 
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors bg-primary/5 hover:bg-primary/10 px-2.5 py-1 min-h-11 md:min-h-0 rounded-lg border border-primary/20 shrink-0"
                  >
                    {t('dashboard.recentNotifications.viewAll')} <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                {stats.recentMessages && stats.recentMessages.length > 0 ? (
                  stats.recentMessages.map((msg: MessageActivity, idx: number) => (
                    <div 
                      key={idx} 
                      onClick={() => handleSelectMessage(msg)}
                      className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-4 p-3 cursor-pointer group hover:bg-muted/30 rounded-xl transition-all duration-200 border border-border/20 hover:border-border/40"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${!msg.isRead ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' : 'bg-muted text-muted-foreground border-border/40'}`}>
                            <Mail className="h-4.5 w-4.5" />
                          </div>
                          {!msg.isRead && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-background ring-1 ring-amber-500/20 animate-pulse" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors min-w-0">
                              {msg.name || t('dashboard.recentNotifications.anonymous')}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground truncate font-semibold mt-0.5">{msg.subject}</p>
                        </div>
                      </div>
                      <div className="flex flex-row items-center justify-between lg:flex-col lg:items-end gap-1.5 shrink-0 pl-0 lg:pl-2 w-full lg:w-auto border-t border-border/10 pt-2 lg:border-0 lg:pt-0">
                        {msg.isRead ? (
                          <Badge variant="outline" className="text-[11px] py-0.5 px-1.5 font-bold tracking-wide uppercase border-muted-foreground/30 text-muted-foreground bg-muted w-fit">
                            {t('dashboard.recentNotifications.read', 'Read')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] py-0.5 px-1.5 font-bold tracking-wide uppercase border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10 animate-pulse w-fit">
                            {t('dashboard.recentNotifications.newBadge', 'New')}
                          </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {msg.createdAt.split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{t('dashboard.recentNotifications.noneMessage')}</p>
                      <p className="text-xs text-muted-foreground">{t('dashboard.recentNotifications.empty')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── CHARTS & DECISION INTEL ROW ── */}
          <div className="grid gap-6 lg:grid-cols-3">
            
            {/* Interactive Analytics Charts (Line/Bar tabs) */}
            <div className="lg:col-span-2 bg-card/65 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-border/50 shadow-md space-y-6 flex flex-col min-w-0 overflow-hidden w-full h-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40 shrink-0">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> {t('dashboard.analytics.title')}
                  </h2>
                  <p className="text-xs text-muted-foreground">{t('dashboard.analytics.desc')}</p>
                </div>
                {/* Custom Tab Selector */}
                <div className="flex p-0.5 rounded-xl bg-muted/60 border border-border/30 w-fit shrink-0 self-start sm:self-center">
                  <button 
                    onClick={() => { setActiveTab('registrations'); setHoveredPointIndex(null); }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'registrations' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {t('dashboard.analytics.signups', 'Signups')}
                  </button>
                  <button 
                    onClick={() => { setActiveTab('inquiries'); setHoveredPointIndex(null); }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'inquiries' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {t('dashboard.analytics.inquiries', 'Inquiries')}
                  </button>
                </div>
              </div>

              {/* Render Active Chart inside container */}
              <div className="flex-1 flex items-center justify-center min-h-[220px] py-2 w-full min-w-0">
                {activeTab === 'registrations' && (
                  <SmoothLineChart 
                    data={stats.registrationTrend} 
                    label={t('dashboard.analytics.newRegistrations', 'New Registrations')}
                    hoveredIndex={hoveredPointIndex}
                    setHoveredIndex={setHoveredPointIndex}
                    gradientId="regChartGrad"
                  />
                )}
                {activeTab === 'inquiries' && (
                  <CustomBarChart 
                    data={stats.messagesTrend} 
                    label={t('dashboard.analytics.supportMessages', 'Support Messages')}
                    hoveredIndex={hoveredPointIndex}
                    setHoveredIndex={setHoveredPointIndex}
                    gradientId="msgChartGrad"
                  />
                )}
              </div>
            </div>

            {/* Device & Visitor Analytics Card */}
            <DeviceAnalyticsCard stats={stats} />

          </div>
        </>

          )}
        </TabsContent>

        <TabsContent value="system" className="mt-0 space-y-8">
          {loading ? (
            <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-7xl space-y-8 animate-pulse">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 h-96 bg-muted/50 rounded-xl border border-border/40" />
                <div className="h-96 bg-muted/50 rounded-xl border border-border/40" />
              </div>
            </div>
          ) : (error || !stats) ? (
            <div className="container mx-auto py-12 px-4 max-w-2xl text-center space-y-6">
              <div className="inline-flex p-4 rounded-full bg-danger/10 text-danger border border-danger/25">
                <ShieldAlert className="h-10 w-10" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.error.handshakeFailure', 'Telemetry Handshake Failure')}</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">{error || t('dashboard.error.couldNotRetrieve', "Could not retrieve statistics.")}</p>
              <Button onClick={() => fetchStats(true)} className="gap-2">
                <RefreshCw className="h-4 w-4" /> {t('dashboard.error.retryHandshake', 'Retry Handshake')}
              </Button>
            </div>
          ) : (
            <>
          {/* ── SYSTEM OPERATIONS VIEW ── */}
          <div className="grid gap-6 lg:grid-cols-3">
            
            {/* Core Engine Telemetry Chart */}
            <div className="lg:col-span-2 bg-card/65 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-border/50 shadow-md space-y-6 flex flex-col justify-between min-w-0 overflow-hidden w-full">
              <div className="pb-2 border-b border-border/40">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Cpu className="h-4.5 w-4.5 text-primary" /> {t('dashboard.system.coreEngineTelemetry', 'Core Engine Telemetry')}
                </h2>
                <p className="text-xs text-muted-foreground">{t('dashboard.system.coreEngineTelemetryDesc', 'Database health and active SQL prepared statement logging metrics.')}</p>
              </div>
              <div className="flex-1 flex items-center justify-center min-h-[220px] py-2 w-full min-w-0">
                <SmoothLineChart 
                  data={stats.queriesTrend} 
                  label={t('dashboard.system.databaseQueries', 'Database Queries')}
                  hoveredIndex={hoveredPointIndex}
                  setHoveredIndex={setHoveredPointIndex}
                  gradientId="devQueChartGrad"
                />
              </div>
            </div>

            {/* System Status & Gateways Panel */}
            <SystemStatusAndGatewaysCard stats={stats} />

          </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Shared detail dialog */}
      {selectedMessage && (
        <ContactDetailDialog
          isOpen={!!selectedMessage}
          onClose={() => setSelectedMessage(null)}
          message={{
            id: selectedMessage.id,
            name: selectedMessage.name,
            email: selectedMessage.email,
            subject: selectedMessage.subject,
            message: selectedMessage.message,
            createdAt: selectedMessage.createdAt,
            isRead: selectedMessage.isRead,
            statusId: selectedMessage.statusId,
            statusName: selectedMessage.statusName,
            statusColor: selectedMessage.statusColor,
            sentChannels: selectedMessage.sentChannels,
            type: selectedMessage.type,
            ipAddress: selectedMessage.ipAddress,
            replyMessage: selectedMessage.replyMessage,
          }}
          onUpdate={handleDialogUpdate}
        />
      )}

      {/* Email Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[420px] w-[calc(100%-2rem)] !flex !flex-col !gap-0 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-0 overflow-hidden z-[70] animate-in zoom-in-95 duration-200">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 space-y-1.5 shrink-0 bg-gradient-to-br from-card to-amber-500/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-sm shrink-0">
                <Mail size={15} strokeWidth={2.5} />
              </div>
              <DialogTitle className="text-base font-black leading-tight text-foreground">
                {t('dashboard.alerts.verifyEmail', 'Verify Your Email')}
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground pt-1.5 font-medium leading-relaxed">
              {t('dashboard.alerts.verifyEmailDesc1', 'We have triggered a 6-digit confirmation code to your email address: ')}<strong className="text-foreground">{user?.email}</strong>{t('dashboard.alerts.verifyEmailDesc2', '. Please enter the code below.')}
            </p>
          </DialogHeader>

          <div className="grid gap-5 p-6 py-5 overflow-y-auto bg-card/20">

            <div className="space-y-2">
              <Label htmlFor="dashboard-confirm-code" className="text-xs font-bold text-foreground">
                {t('dashboard.alerts.verificationCode', 'Verification Code')} <span className="text-danger">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="dashboard-confirm-code"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder={t('dashboard.alerts.enterCode', 'Enter 6-digit code')}
                  className="h-9 rounded-xl border-border/60 text-xs font-medium bg-background/30"
                  maxLength={6}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendCode}
                  disabled={sendingCode || countdown > 0}
                  className="h-9 rounded-xl font-bold text-xs shrink-0 px-4 border-border/60 hover:bg-muted"
                >
                  {sendingCode ? t('dashboard.alerts.sending', 'Sending...') : countdown > 0 ? t('dashboard.alerts.resendIn', { defaultValue: 'Resend in {{seconds}}s', seconds: countdown }) : t('dashboard.alerts.resendCode', 'Resend Code')}
                </Button>
              </div>
            </div>
          </div>

          <div className="!mx-0 !mb-0 !flex !flex-row !items-center !justify-end border-t border-border/40 !p-4 !px-6 bg-muted/20 shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setConfirmOpen(false);
                setConfirmCode('');
              }}
              disabled={verifyingEmail}
              className="h-9 rounded-xl font-bold text-xs hover:bg-muted border border-transparent hover:border-border/30 px-4"
            >
              {t('dashboard.alerts.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleVerifyEmail}
              disabled={verifyingEmail || !confirmCode.trim()}
              className="h-9 rounded-xl font-bold text-xs bg-warning hover:bg-warning/90 text-warning-foreground transition-all active:scale-95 px-4 shadow-sm border border-amber-500/10"
            >
              {verifyingEmail ? t('dashboard.alerts.verifying', 'Verifying...') : t('dashboard.alerts.verifyButton', 'Verify Email')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {selectedUser && (
        <UserDetailDialog
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          user={{
            id: selectedUser.id,
            name: selectedUser.name,
            email: selectedUser.email,
            role: selectedUser.role,
            phone: selectedUser.phone,
            isActive: selectedUser.isActive ?? selectedUser.active,
            lastLoginAt: selectedUser.lastLoginAt,
            createdAt: selectedUser.createdAt,
            updatedAt: selectedUser.updatedAt,
          }}
          onEdit={() => {
            const mappedUser: User = {
              id: selectedUser.id,
              name: selectedUser.name,
              email: selectedUser.email,
              role: selectedUser.role,
              phone: selectedUser.phone ?? '',
              active: selectedUser.isActive ?? selectedUser.active ?? true,
              createdAt: selectedUser.createdAt,
              lastLoginAt: selectedUser.lastLoginAt ?? null,
            };
            openModal(mappedUser);
          }}
          onDelete={() => {
            const mappedUser: User = {
              id: selectedUser.id,
              name: selectedUser.name,
              email: selectedUser.email,
              role: selectedUser.role,
              phone: selectedUser.phone ?? '',
              active: selectedUser.isActive ?? selectedUser.active ?? true,
              createdAt: selectedUser.createdAt,
              lastLoginAt: selectedUser.lastLoginAt ?? null,
            };
            setDeleteUser(mappedUser);
          }}
          onResetPassword={() => {
            const mappedUser: User = {
              id: selectedUser.id,
              name: selectedUser.name,
              email: selectedUser.email,
              role: selectedUser.role,
              phone: selectedUser.phone ?? '',
              active: selectedUser.isActive ?? selectedUser.active ?? true,
              createdAt: selectedUser.createdAt,
              lastLoginAt: selectedUser.lastLoginAt ?? null,
            };
            setResetPasswordUser(mappedUser);
          }}
        />
      )}

      <UserFormDialog
        isOpen={isModalOpen}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
        editingUser={editingUser}
        formData={formData}
        formErrors={formErrors}
        isSubmitting={isSubmitting}
        onField={setField}
        onSubmit={async (e) => {
          await handleSubmit(e);
          fetchStats(true);
        }}
        onOpenCreate={() => openModal()}
        hideTrigger={true}
      />

      <UserResetPasswordDialog
        isOpen={!!resetPasswordUser}
        onOpenChange={(open) => {
          if (!open) setResetPasswordUser(null);
        }}
        user={resetPasswordUser}
      />

      <UserDeleteDialog
        isOpen={!!deleteUser}
        onOpenChange={(open) => {
          if (!open) setDeleteUser(null);
        }}
        user={deleteUser}
        onDeleted={() => {
          setDeleteUser(null);
          setSelectedUser(null);
          fetchStats(true);
        }}
      />
    </div>
  );
};
