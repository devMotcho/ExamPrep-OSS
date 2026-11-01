import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField, Req } from '@/shared/components/FormField';
import type { User, UserFormData, UserFormErrors } from '../types';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';

interface UserFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser: User | null;
  formData: UserFormData;
  formErrors: UserFormErrors;
  isSubmitting: boolean;
  onField: <K extends keyof UserFormData>(field: K, value: UserFormData[K]) => void;
  onSubmit: (e: React.FormEvent) => void;
  onOpenCreate?: () => void;
  hideTrigger?: boolean;
}

const isAdminOrDev = (u: User) => u.role === 'ROLE_ADMIN' || u.role === 'ROLE_DEV';

export const UserFormDialog: React.FC<UserFormDialogProps> = ({
  isOpen, onOpenChange, editingUser, formData, formErrors,
  isSubmitting, onField, onSubmit, onOpenCreate, hideTrigger,
}) => {
  const { t } = useTranslation();
  const { role: currentUserRole } = useAuth();
  const canDeactivate = !editingUser || !isAdminOrDev(editingUser);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {!hideTrigger && onOpenCreate && (
        <DialogTrigger render={<Button onClick={onOpenCreate} className="rounded-xl h-9 font-bold text-xs gap-1.5 shrink-0 transition-all active:scale-95 shadow-sm">{t('admin.userForm.createUser', 'Add New User')}</Button>} />
      )}
      <DialogContent className="sm:max-w-[460px] w-[calc(100%-2rem)] !flex !flex-col !gap-0 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-0 overflow-hidden z-[70] animate-in zoom-in-95 duration-200">
        <form onSubmit={onSubmit} noValidate className="flex flex-col m-0">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 space-y-1.5 shrink-0 bg-gradient-to-br from-card to-primary/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-sm shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-pen"><path d="M11.5 15H7a4 4 0 0 0-4 4v2"/><path d="M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/><circle cx="10" cy="7" r="4"/></svg>
              </div>
              <DialogTitle className="text-base font-black leading-tight text-foreground">
                {editingUser ? t('admin.userForm.editUser', 'Edit User') : t('admin.userForm.createUser', 'Create User')}
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground pt-1.5 font-medium leading-relaxed">
              {t('admin.userForm.fillDetails', 'Fill in the user details below.')}
            </p>
          </DialogHeader>

          <div className="grid gap-5 p-6 py-5 max-h-[65vh] overflow-y-auto bg-card/20">
            <FormField
              id="name"
              label={t('admin.userForm.fullName', 'Full Name')}
              required
              value={formData.name}
              onChange={(e) => onField('name', e.target.value)}
              placeholder="John Doe"
              error={formErrors.name}
            />

            <FormField
              id="email"
              label={t('users.form.email', 'Email')}
              required
              type="email"
              value={formData.email}
              onChange={(e) => onField('email', e.target.value)}
              placeholder={t('users.form.placeholderEmail', 'john@example.com')}
              error={formErrors.email}
            />

            <FormField
              id="phone"
              label={t('admin.userForm.phone', 'Phone Number')}
              type="tel"
              value={formData.phone}
              onChange={(e) => onField('phone', e.target.value)}
              placeholder={t('users.form.placeholderPhone', '+351 912 345 678')}
            />

            {/* Role select: developers can see all roles, admins can only assign USER */}
            {(currentUserRole === 'ROLE_DEV' || currentUserRole === 'ROLE_ADMIN') && (
              <div className="space-y-1.5">
                <Label htmlFor="role" className="text-xs font-bold text-muted-foreground">{t('admin.userForm.role', 'Role')} <Req /></Label>
                <select
                  id="role"
                  className="flex h-9 w-full rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  value={formData.role}
                  onChange={(e) => onField('role', e.target.value)}
                  disabled={formData.role === 'ROLE_DEV' && currentUserRole !== 'ROLE_DEV'}
                >
                  <option value="USER">{t('admin.userDetail.standardUser', 'User')}</option>
                  {currentUserRole === 'ROLE_DEV' && (
                    <option value="ROLE_ADMIN">{t('admin.userDetail.administrator', 'Administrator')}</option>
                  )}
                  {formData.role === 'ROLE_DEV' && (
                    <option value="ROLE_DEV">Developer</option>
                  )}
                </select>
              </div>
            )}

            {/* Password — only shown when creating a new user. For existing users, password resets are handled via a dedicated reset endpoint */}
            {!editingUser && (
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-bold text-muted-foreground">
                  {t('admin.userForm.password', 'Password')} <Req />
                </Label>
                <FormField
                  id="password"
                  label=""
                  type="password"
                  value={formData.password}
                  onChange={(e) => onField('password', e.target.value)}
                  placeholder={t('users.form.placeholderPassword', 'Min. 8 characters')}
                  error={formErrors.password}
                />
              </div>
            )}

            {/* Active toggle — hidden for admin accounts */}
            {canDeactivate && (
              <div className="space-y-1.5">
                <Label htmlFor="active" className="text-xs font-bold text-muted-foreground">{t('admin.userForm.accountStatus', 'Status')}</Label>
                <div className="flex items-center gap-2.5 h-10 px-0.5">
                  <input
                    type="checkbox"
                    id="active"
                    className="w-4 h-4 rounded border-border bg-background/50 text-primary focus:ring-primary cursor-pointer"
                    checked={formData.active}
                    onChange={(e) => onField('active', e.target.checked)}
                  />
                  <span className="text-xs text-muted-foreground font-semibold cursor-pointer select-none" onClick={() => onField('active', !formData.active)}>
                    {formData.active ? t('users.form.statusActive', 'Active — user can log in') : t('users.form.statusDisabled', 'Disabled — user cannot log in')}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="!mx-0 !mb-0 !flex !flex-row !items-center !justify-end border-t border-border/40 !p-4 !px-6 bg-muted/20 shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-xl font-bold text-xs hover:bg-muted border border-transparent hover:border-border/30 px-4"
              disabled={isSubmitting}
            >
              {t('admin.userForm.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 rounded-xl font-bold text-xs bg-warning hover:bg-warning/90 text-warning-foreground transition-all active:scale-95 px-4 shadow-sm border border-amber-500/10"
            >
              {isSubmitting ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-loader-2 mr-1.5 animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  {t('admin.userForm.saving', 'Saving...')}
                </>
              ) : editingUser ? (
                t('admin.userForm.saveChanges', 'Save changes')
              ) : (
                t('admin.userForm.create', 'Create user')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
