import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FormField, Req } from '@/shared/components/FormField';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/lib/config/useConfig';
import { useToast } from '@/context/ToastContext';
import { authService } from '@/features/auth';
import { getErrorMessage } from '@/shared/utils/errors';
import { Key, Loader2, Mail } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const config = useConfig();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');

  // Field errors
  const [currentPasswordErr, setCurrentPasswordErr] = useState<string | undefined>(undefined);
  const [newPasswordErr, setNewPasswordErr] = useState<string | undefined>(undefined);
  const [confirmPasswordErr, setConfirmPasswordErr] = useState<string | undefined>(undefined);
  const [codeErr, setCodeErr] = useState<string | undefined>(undefined);

  // States
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const isCodeRequired = config.confirmation_code_enabled === 'true';

  // Handle countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Reset states on open/close
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setCode('');
      setCurrentPasswordErr(undefined);
      setNewPasswordErr(undefined);
      setConfirmPasswordErr(undefined);
      setCodeErr(undefined);
      setCountdown(0);
    }
  }, [isOpen]);

  const validateStep1 = () => {
    let hasErrors = false;
    setCurrentPasswordErr(undefined);
    setNewPasswordErr(undefined);
    setConfirmPasswordErr(undefined);

    if (!currentPassword) {
      setCurrentPasswordErr('Current password is required.');
      hasErrors = true;
    }

    if (!newPassword) {
      setNewPasswordErr('New password is required.');
      hasErrors = true;
    } else if (newPassword.length < 8) {
      setNewPasswordErr('New password must be at least 8 characters.');
      hasErrors = true;
    }

    if (!confirmPassword) {
      setConfirmPasswordErr('Please confirm the new password.');
      hasErrors = true;
    } else if (newPassword && newPassword !== confirmPassword) {
      setConfirmPasswordErr('Passwords do not match.');
      hasErrors = true;
    }

    return !hasErrors;
  };

  const handleSendCode = async () => {
    if (sendingCode) return false;
    if (!user?.email) {
      toast({ type: 'error', message: 'Unable to resolve user email.' });
      return false;
    }

    setSendingCode(true);
    try {
      await authService.sendCode(user.email);
      toast({ type: 'success', message: 'Verification code sent to your email.' });
      setCountdown(60);
      return true;
    } catch (err: any) {
      toast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to send verification code.',
      });
      return false;
    } finally {
      setSendingCode(false);
    }
  };

  const onFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!validateStep1()) return;

      if (isCodeRequired) {
        setLoading(true);
        const codeSent = await handleSendCode();
        setLoading(false);
        if (codeSent) {
          setStep(2);
        }
        return;
      }
    } else if (step === 2 && isCodeRequired) {
      setCodeErr(undefined);
      if (!code.trim()) {
        setCodeErr('Verification code is required.');
        return;
      }
    }

    // Submit request
    setLoading(true);
    try {
      const payload: any = {
        currentPassword,
        newPassword,
      };
      if (isCodeRequired) {
        payload.code = code.trim();
      }

      await authService.changePassword(payload);
      toast({ type: 'success', message: 'Password changed successfully.' });
      onOpenChange(false);
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to change password.');
      if (step === 2 && msg.toLowerCase().includes('code')) {
        setCodeErr(msg);
      } else {
        toast({ type: 'error', message: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] w-[calc(100%-2rem)] !flex !flex-col !gap-0 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-0 overflow-hidden z-[70] animate-in zoom-in-95 duration-200">
        <form onSubmit={onFormSubmit} noValidate className="flex flex-col m-0">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 space-y-1.5 shrink-0 bg-gradient-to-br from-card to-primary/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm shrink-0">
                <Key size={15} strokeWidth={2.5} />
              </div>
              <DialogTitle className="text-base font-black leading-tight text-foreground">
                {t('auth.changePassword.title', 'Change Password')}
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground pt-1.5 font-medium leading-relaxed">
              {t('auth.changePassword.description', 'Update your account password. Secure your account using a strong password.')}
            </p>
          </DialogHeader>

          <div className="grid gap-5 p-6 py-5 overflow-y-auto bg-card/20">
            {step === 1 ? (
              <div className="space-y-4 animate-in fade-in duration-300">
                <FormField
                  id="current-password"
                  label={t('auth.changePassword.currentPassword', 'Current Password')}
                  required
                  type="password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    setCurrentPasswordErr(undefined);
                  }}
                  placeholder={t('auth.changePassword.currentPasswordPlaceholder', 'Enter current password')}
                  error={currentPasswordErr}
                />

                <FormField
                  id="new-password"
                  label={t('auth.changePassword.newPassword', 'New Password')}
                  required
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setNewPasswordErr(undefined);
                  }}
                  placeholder={t('auth.changePassword.newPasswordPlaceholder', 'Min. 8 characters')}
                  error={newPasswordErr}
                />

                <FormField
                  id="confirm-new-password"
                  label={t('auth.changePassword.confirmNewPassword', 'Confirm New Password')}
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setConfirmPasswordErr(undefined);
                  }}
                  placeholder={t('auth.changePassword.confirmNewPasswordPlaceholder', 'Repeat new password')}
                  error={confirmPasswordErr}
                />
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-right-3 duration-300">
                <div className="p-3.5 bg-primary/5 border border-primary/15 rounded-xl space-y-1.5 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/15 mt-0.5">
                    <Mail size={12} strokeWidth={2.5} />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-foreground">{t('auth.changePassword.verifyEmail', 'Verify Your Email')}</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t('auth.changePassword.verifyEmailDescription', 'We have sent a 6-digit confirmation code to your email')} <strong className="text-foreground">{user?.email}</strong>{t('auth.changePassword.verifyEmailDescriptionSuffix', '. Enter it below to authorize this password change.')}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="verification-code" className="text-xs font-bold text-muted-foreground">
                    {t('auth.changePassword.verificationCode', 'Verification Code')} <Req />
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="verification-code"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setCodeErr(undefined);
                      }}
                      placeholder={t('auth.changePassword.verificationCodePlaceholder', 'Enter 6-digit code')}
                      className="h-9 rounded-xl border-border/60 text-xs font-semibold bg-background/30 px-3 flex-1"
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
                      {sendingCode ? t('auth.changePassword.sending', 'Sending...') : countdown > 0 ? t('auth.changePassword.resendIn', 'Resend in {{seconds}}s', { seconds: countdown }) : t('auth.changePassword.sendCode', 'Send Code')}
                    </Button>
                  </div>
                  {codeErr && <p className="text-[11px] text-danger font-medium">{codeErr}</p>}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="!mx-0 !mb-0 !flex !flex-row !items-center !justify-end border-t border-border/40 !p-4 !px-6 bg-muted/20 shrink-0 gap-2">
            {step === 1 ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="h-9 rounded-xl font-bold text-xs hover:bg-muted border border-transparent hover:border-border/30 px-4"
                  disabled={loading}
                >
                  {t('auth.changePassword.cancel', 'Cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-9 rounded-xl font-bold text-xs transition-all active:scale-95 px-4 shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      {t('auth.changePassword.updating', 'Updating...')}
                    </>
                  ) : isCodeRequired ? (
                    t('auth.changePassword.continue', 'Continue')
                  ) : (
                    t('auth.changePassword.title', 'Change Password')
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="h-9 rounded-xl font-bold text-xs hover:bg-muted border border-transparent hover:border-border/30 px-4"
                  disabled={loading}
                >
                  {t('auth.changePassword.cancel', 'Cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-9 rounded-xl font-bold text-xs transition-all active:scale-95 px-4 shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      {t('auth.changePassword.updating', 'Updating...')}
                    </>
                  ) : (
                    t('auth.changePassword.verifyAndChange', 'Verify & Change Password')
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
