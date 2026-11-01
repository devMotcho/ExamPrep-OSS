import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FormField } from '@/shared/components/FormField';
import type { User } from '../types';
import { userService } from '../services/userService';
import { useToast } from '@/context/ToastContext';
import { getErrorMessage } from '@/shared/utils/errors';
import { Key, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UserResetPasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export const UserResetPasswordDialog: React.FC<UserResetPasswordDialogProps> = ({
  isOpen,
  onOpenChange,
  user,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear fields on open/close or user change
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPassword('');
      setError(undefined);
      setConfirmError(undefined);
    }
  }, [isOpen, user]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setConfirmError(undefined);

    let hasErrors = false;
    if (!password) {
      setError(t('users.reset.passwordRequired', 'Password is required.'));
      hasErrors = true;
    } else if (password.length < 8) {
      setError(t('users.reset.passwordLength', 'Password must be at least 8 characters.'));
      hasErrors = true;
    }

    if (!confirmPassword) {
      setConfirmError(t('users.reset.confirmRequired', 'Please confirm the password.'));
      hasErrors = true;
    } else if (password !== confirmPassword) {
      setConfirmError(t('users.reset.passwordMismatch', 'Passwords do not match.'));
      hasErrors = true;
    }

    if (hasErrors) return;

    setIsSubmitting(true);
    try {
      await userService.resetPassword(user.id, password);
      toast({
        type: 'success',
        message: t('users.reset.successMsg', `Password for ${user.name || user.email} has been reset successfully.`),
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        type: 'error',
        message: getErrorMessage(err, t('users.reset.failedMsg', 'Failed to reset password.')),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] w-[calc(100%-2rem)] !flex !flex-col !gap-0 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-0 overflow-hidden z-[70] animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col m-0">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 space-y-1.5 shrink-0 bg-gradient-to-br from-card to-primary/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-sm shrink-0">
                <Key size={15} strokeWidth={2.5} />
              </div>
              <DialogTitle className="text-base font-black leading-tight text-foreground">
                {t('admin.userReset.title', 'Reset Password')}
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground pt-1.5 font-medium leading-relaxed">
              {t('admin.userReset.description', 'Generate a secure temporary password for')} <strong className="text-foreground">{user.name || user.email}</strong>. {t('admin.userReset.warning', 'The user will be required to change their password upon their next login.')}
            </p>
          </DialogHeader>

          <div className="grid gap-5 p-6 py-5 overflow-y-auto bg-card/20">
            <FormField
              id="new-password"
              label={t('admin.userReset.newPassword', 'New Temporary Password')}
              required
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(undefined);
              }}
              placeholder={t('users.form.placeholderPassword', 'Min. 8 characters')}
              error={error}
            />

            <FormField
              id="confirm-new-password"
              label={t('users.reset.confirmNewPassword', 'Confirm New Password')}
              required
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setConfirmError(undefined);
              }}
              placeholder={t('users.reset.placeholderRepeat', 'Repeat new password')}
              error={confirmError}
            />
          </div>

          <DialogFooter className="!mx-0 !mb-0 !flex !flex-row !items-center !justify-end border-t border-border/40 !p-4 !px-6 bg-muted/20 shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-xl font-bold text-xs hover:bg-muted border border-transparent hover:border-border/30 px-4"
              disabled={isSubmitting}
            >
              {t('admin.userReset.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-95 px-4 shadow-sm border border-blue-600/10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {t('admin.userReset.generating', 'Generating...')}
                </>
              ) : (
                t('admin.userReset.confirm', 'Yes, generate new password')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
