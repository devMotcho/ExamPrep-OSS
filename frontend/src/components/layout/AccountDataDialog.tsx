import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/shared/components/FormField';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/lib/config/useConfig';
import { useToast } from '@/context/ToastContext';
import { useLocale } from '@/hooks/useLocale';
import { authService } from '@/features/auth';
import { getErrorMessage } from '@/shared/utils/errors';

interface AccountDataDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const sectionClass = 'space-y-3 rounded-xl border border-border/50 p-4';
const sectionTitleClass = 'text-sm font-bold text-foreground';
const buttonClass = 'h-9 rounded-xl font-bold text-xs px-4';

/** The account owner's data rights: see and download, correct, and delete. */
export const AccountDataDialog: React.FC<AccountDataDialogProps> = ({ isOpen, onOpenChange }) => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const config = useConfig();
  const { toast } = useToast();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const usesProvider = Boolean(user?.oauthProvider);
  const isStaff = user?.role === 'ROLE_ADMIN' || user?.role === 'ROLE_DEV';
  const isCodeRequired = config.confirmation_code_enabled === 'true';

  const [name, setName] = useState('');
  const [publicName, setPublicName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [deleteSecret, setDeleteSecret] = useState('');
  const [deleteCodeSent, setDeleteCodeSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(user?.name ?? '');
      setPublicName(user?.publicName ?? '');
      setNewEmail('');
      setEmailPassword('');
      setEmailCode('');
      setEmailCodeSent(false);
      setDeleteSecret('');
      setDeleteCodeSent(false);
      setBusy(null);
    }
  }, [isOpen, user?.name, user?.publicName]);

  const run = async (key: string, action: () => Promise<void>, fallback: string) => {
    setBusy(key);
    try {
      await action();
    } catch (err) {
      toast({ type: 'error', message: getErrorMessage(err, fallback) });
    } finally {
      setBusy(null);
    }
  };

  const saveProfile = () => run('profile', async () => {
    await authService.updateProfile({ name, publicName });
    await refreshUser();
    toast({ type: 'success', message: t('account.data.profileSaved', 'Profile saved.') });
  }, t('account.data.profileFailed', 'Could not save the profile.'));

  const sendEmailCode = () => run('email', async () => {
    await authService.sendCode(newEmail.trim(), 'EMAIL_CHANGE');
    setEmailCodeSent(true);
    toast({ type: 'success', message: t('account.data.codeSentTo', 'We sent a code to {{email}}.', { email: newEmail.trim() }) });
  }, t('account.data.codeFailed', 'Could not send the code.'));

  const confirmEmail = () => run('email', async () => {
    await authService.changeEmail({
      newEmail: newEmail.trim(),
      password: emailPassword,
      ...(isCodeRequired ? { code: emailCode.trim() } : {}),
    });
    await refreshUser();
    setEmailCodeSent(false);
    setNewEmail('');
    setEmailPassword('');
    setEmailCode('');
    toast({ type: 'success', message: t('account.data.emailChanged', 'Email changed.') });
  }, t('account.data.emailFailed', 'Could not change the email.'));

  const download = () => run('export', async () => {
    const res = await authService.exportData();
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `examprep-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, t('account.data.exportFailed', 'Could not prepare the download.'));

  const sendDeleteCode = () => run('delete', async () => {
    if (!user?.email) return;
    await authService.sendCode(user.email, 'ACCOUNT_DELETION');
    setDeleteCodeSent(true);
    toast({ type: 'success', message: t('account.data.codeSentTo', 'We sent a code to {{email}}.', { email: user.email }) });
  }, t('account.data.codeFailed', 'Could not send the code.'));

  const deleteAccount = () => run('delete', async () => {
    await authService.deleteAccount(usesProvider ? { code: deleteSecret.trim() } : { password: deleteSecret });
    onOpenChange(false);
    window.dispatchEvent(new Event('auth-logout'));
    toast({ type: 'success', message: t('account.data.deleted', 'Your account was deleted.') });
    navigate(`/${locale}`);
  }, t('account.data.deleteFailed', 'Could not delete the account.'));

  const emailNeedsCodeStep = isCodeRequired && !emailCodeSent;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] w-[calc(100%-2rem)] max-h-[90vh] !flex !flex-col !gap-0 bg-card border border-border shadow-2xl rounded-2xl p-0 overflow-hidden z-[70]">
        <DialogHeader className="p-6 pb-4 border-b border-border/40 space-y-1.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <ShieldCheck size={15} strokeWidth={2.5} />
            </div>
            <DialogTitle className="text-base font-black leading-tight text-foreground">
              {t('account.data.title', 'Your data')}
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground pt-1.5 font-medium leading-relaxed">
            {t('account.data.description', 'See, correct and download what is stored about you, or delete your account.')}
          </p>
        </DialogHeader>

        <div className="grid gap-4 p-6 overflow-y-auto">
          <section className={sectionClass}>
            <h3 className={sectionTitleClass}>{t('account.data.profileTitle', 'Profile')}</h3>
            <FormField id="account-name" label={t('account.data.name', 'Name')} value={name}
              onChange={(e) => setName(e.target.value)} maxLength={100} />
            <FormField id="account-public-name" label={t('account.data.publicName', 'Public name')} value={publicName}
              onChange={(e) => setPublicName(e.target.value)} maxLength={60}
              placeholder={(user?.name ?? '').trim().split(/\s+/)[0] || t('account.data.anonymous', 'Anonymous')} />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t('account.data.publicNameHelp', 'Shown on the study areas you make public. Leave it empty to show the first word of your name.')}
            </p>
            <div className="flex justify-end">
              <Button type="button" onClick={saveProfile} disabled={busy !== null || !name.trim()} className={buttonClass}>
                {busy === 'profile' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {t('account.data.save', 'Save')}
              </Button>
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className={sectionTitleClass}>{t('account.data.emailTitle', 'Email')}</h3>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            {usesProvider ? (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t('account.data.emailProvider', 'This account signs in with {{provider}}, so the email is managed there.', { provider: user?.oauthProvider })}
              </p>
            ) : (
              <>
                <FormField id="account-new-email" label={t('account.data.newEmail', 'New email')} type="email" value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)} disabled={emailCodeSent} />
                <FormField id="account-email-password" label={t('account.data.password', 'Current password')} type="password"
                  value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
                {emailCodeSent && (
                  <FormField id="account-email-code" label={t('account.data.code', 'Code from the email')} value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)} maxLength={6} />
                )}
                <div className="flex justify-end">
                  <Button type="button" variant="outline" className={buttonClass}
                    disabled={busy !== null || !newEmail.trim() || !emailPassword || (emailCodeSent && !emailCode.trim())}
                    onClick={emailNeedsCodeStep ? sendEmailCode : confirmEmail}>
                    {busy === 'email' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {emailNeedsCodeStep ? t('account.data.sendCode', 'Send code') : t('account.data.confirmEmail', 'Change email')}
                  </Button>
                </div>
              </>
            )}
          </section>

          <section className={sectionClass}>
            <h3 className={sectionTitleClass}>{t('account.data.exportTitle', 'Download your data')}</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t('account.data.exportHelp', 'A JSON file with your account, study areas, questions, exams and everything else stored about you.')}
            </p>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={download} disabled={busy !== null} className={buttonClass}>
                {busy === 'export' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                {t('account.data.download', 'Download')}
              </Button>
            </div>
          </section>

          {!isStaff && (
            <section className={`${sectionClass} border-danger/40`}>
              <h3 className="text-sm font-bold text-danger">{t('account.data.deleteTitle', 'Delete account')}</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t('account.data.deleteHelp', 'This cannot be undone. Your profile, exams, private study areas and images are deleted. Study areas other people use stay, credited to “Community”.')}
              </p>
              {usesProvider ? (
                deleteCodeSent && (
                  <FormField id="account-delete-code" label={t('account.data.code', 'Code from the email')} value={deleteSecret}
                    onChange={(e) => setDeleteSecret(e.target.value)} maxLength={6} />
                )
              ) : (
                <FormField id="account-delete-password" label={t('account.data.password', 'Current password')} type="password"
                  value={deleteSecret} onChange={(e) => setDeleteSecret(e.target.value)} />
              )}
              <div className="flex justify-end">
                <Button type="button" variant="destructive" className={buttonClass}
                  disabled={busy !== null || ((!usesProvider || deleteCodeSent) && !deleteSecret.trim())}
                  onClick={usesProvider && !deleteCodeSent ? sendDeleteCode : deleteAccount}>
                  {busy === 'delete' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                  {usesProvider && !deleteCodeSent ? t('account.data.sendCode', 'Send code') : t('account.data.deleteForever', 'Delete my account')}
                </Button>
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
